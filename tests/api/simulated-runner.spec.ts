import { expect, test } from '@playwright/test';
import {
  PASSING_CHECKOUT_TS,
  PASSING_PAYMENT_TS,
} from '../helpers/session-fixtures';
import { runSimulatedCheckoutTests, runSimulatedCommand } from '../../lib/sandbox/simulated-provider';

const PARTIAL_QUANTITY_CART_TS = `export type CartItem = {
  sku: string;
  quantity: number;
  priceCents: number;
};

export function validateCart(items: CartItem[]) {
  if (items.length === 0) {
    throw new Error('Cart is empty');
  }

  for (const item of items) {
    if (!item.sku) {
      throw new Error('Missing SKU');
    }

    if (item.quantity <= 0) {
      throw new Error('Invalid quantity');
    }
  }
}

export function totalCents(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);
}
`;

const NOTIFICATION_WORKSPACE_BASE = [
  {
    path: 'BRIEF.md',
    language: 'markdown',
    content: '# Real-time Notification System with Resilient Delivery',
  },
  {
    path: 'tests/notification-system.test.ts',
    language: 'typescript',
    content: 'describe("notification system", () => {});',
  },
  {
    path: 'backend/src/rate-limit.ts',
    language: 'typescript',
    content: `export async function checkRateLimit(redis, userId, type) {
  const key = 'rate:' + userId + ':' + type;
  const count = await redis.incr(key);
  await redis.expire(key, 60);
  return count <= 5;
}
`,
  },
  {
    path: 'backend/src/idempotency.ts',
    language: 'typescript',
    content: `import crypto from 'crypto';
export async function hasRecentlySent(redis, userId, payload) {
  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  return redis.set('dedupe:' + userId + ':' + hash, '1', 'EX', 300, 'NX');
}
`,
  },
  {
    path: 'frontend/pages/dashboard.tsx',
    language: 'typescript',
    content: `useEffect(() => {
  const socket = connectNotifications();
  socket.onmessage = handleNotification;
  return () => socket.close();
}, []);
`,
  },
  {
    path: 'frontend/components/NotificationDisplay.tsx',
    language: 'typescript',
    content: `export function mergeNotification(current, notification) {
  const seen = new Set(current.map((item) => item.id));
  if (seen.has(notification.id)) return current;
  return [notification, ...current].sort((a, b) => b.streamId.localeCompare(a.streamId));
}
`,
  },
] as const;

function notificationWorkspaceWith(
  serverContent: string,
  extraFiles: Array<{ path: string; language: string; content: string }> = [],
) {
  return [
    ...NOTIFICATION_WORKSPACE_BASE,
    {
      path: 'backend/src/server.ts',
      language: 'typescript',
      content: serverContent,
    },
    ...extraFiles,
  ];
}

test.describe('simulated checkout runner', () => {
  test('does not pass quantity validation unless non-integer and non-positive quantities are both rejected', () => {
    const result = runSimulatedCheckoutTests([
      { path: 'src/cart.ts', language: 'typescript', content: PARTIAL_QUANTITY_CART_TS },
      { path: 'src/payment.ts', language: 'typescript', content: PASSING_PAYMENT_TS },
      { path: 'src/checkout.ts', language: 'typescript', content: PASSING_CHECKOUT_TS },
    ]);

    const quantityTest = result.tests.find((candidate) =>
      candidate.name === 'rejects zero, negative, and non-integer quantities',
    );

    expect(quantityTest?.status).toBe('failed');
    expect(result.output).toContain('Result: 3/4 passed');
  });
});

test.describe('simulated custom task runner', () => {
  test('uses generic evidence checks for non-checkout challenge templates', () => {
    const result = runSimulatedCommand('npm test', [
      {
        path: 'README.md',
        language: 'markdown',
        content: '# Custom task\n\nDiagnose the under-scoped server boundary, then document the root cause, risk controls, and verification evidence for the candidate.',
      },
      {
        path: 'src/solution-plan.ts',
        language: 'typescript',
        content: `export const rootCause = 'The first unsafe behavior is an under-scoped server boundary.';

export const riskControls = [
  'Scope the repository query by workspace before returning data.',
  'Return a neutral not-found response for cross-workspace access.',
];

export const verificationEvidence = [
  'Added same-workspace and cross-workspace access checks.',
];
`,
      },
      { path: 'tests/custom-task.test.ts', language: 'typescript', content: 'describe("custom task", () => {});' },
    ]);

    expect(result.output).toContain('Simulated custom task runner');
    expect(result.output).toContain('Result: 4/4 passed');
  });

  test('checks notification-system starter workspaces with project-specific evidence', () => {
    const result = runSimulatedCommand('npm test', notificationWorkspaceWith(`import { checkRateLimit } from './rate-limit';
import { hasRecentlySent } from './idempotency';
import { createPublisher, createSubscriber } from './redis';
import { getUserProfile } from './models/userProfile';

export async function notify(req, res) {
  const userProfile = await getUserProfile(req.body.userId);
  if (userProfile.inAppEnabled === false) return res.status(202).json({ skipped: true });
  await checkRateLimit(req.body.userId, req.body.type);
  await hasRecentlySent(req.body.userId, req.body.id || req.body.message);
  await createPublisher().publish('notifications', JSON.stringify(req.body));
  return res.status(202).json({ accepted: true });
}

export function attachNotificationRelay(send) {
  const subscriber = createSubscriber();
  subscriber.subscribe('notifications');
  subscriber.on('message', (_channel, message) => send(JSON.parse(message)));
}
`, [
      {
        path: 'backend/src/redis.ts',
        language: 'typescript',
        content: `import Redis from 'ioredis';

export function createPublisher() {
  return new Redis(process.env.REDIS_URL);
}

export function createSubscriber() {
  return new Redis(process.env.REDIS_URL);
}
`,
      },
    ]));

    expect(result.output).toContain('Simulated notification system runner');
    expect(result.output).toContain('Result: 6/6 passed');
  });

  test('fails notification workspaces missing preference enforcement by name', () => {
    const result = runSimulatedCommand('npm test', notificationWorkspaceWith(`import { checkRateLimit } from './rate-limit';
import { hasRecentlySent } from './idempotency';
import { createPublisher, createSubscriber } from './redis';

export async function notify(req, res) {
  await checkRateLimit(req.body.userId, req.body.type);
  await hasRecentlySent(req.body.userId, req.body.id || req.body.message);
  await createPublisher().publish('notifications', JSON.stringify(req.body));
  return res.status(202).json({ accepted: true });
}

export function attachNotificationRelay(send) {
  const subscriber = createSubscriber();
  subscriber.subscribe('notifications');
  subscriber.on('message', (_channel, message) => send(JSON.parse(message)));
}
`, [
      {
        path: 'backend/src/redis.ts',
        language: 'typescript',
        content: `import Redis from 'ioredis';

export function createPublisher() {
  return new Redis(process.env.REDIS_URL);
}

export function createSubscriber() {
  return new Redis(process.env.REDIS_URL);
}
`,
      },
    ]));

    const preferenceTest = result.tests.find((candidate) =>
      candidate.name === 'respects in-app notification preferences before delivery',
    );

    expect(preferenceTest?.status).toBe('failed');
    expect(result.output).toContain('FAIL respects in-app notification preferences before delivery');
  });

  test('fails notification workspaces that keep one shared Redis Pub/Sub client', () => {
    const result = runSimulatedCommand('npm test', notificationWorkspaceWith(`import { checkRateLimit } from './rate-limit';
import { hasRecentlySent } from './idempotency';
import { createPublisher, createSubscriber } from './redis-client';
import { getUserProfile } from './models/userProfile';

export async function notify(req, res) {
  const preferences = await getUserProfile(req.body.userId);
  if (!preferences.inAppEnabled) return res.status(202).json({ skipped: true });
  await checkRateLimit(req.body.userId, req.body.type);
  await hasRecentlySent(req.body.userId, req.body.id || req.body.message);
  await createPublisher().publish('notifications', JSON.stringify(req.body));
  return res.status(202).json({ accepted: true });
}

export function attachNotificationRelay(send) {
  const subscriber = createSubscriber();
  subscriber.subscribe('notifications');
  subscriber.on('message', (_channel, message) => send(JSON.parse(message)));
}
`, [
      {
        path: 'backend/src/redis-client.ts',
        language: 'typescript',
        content: `import Redis from 'ioredis';

const redisClient = new Redis(process.env.REDIS_URL);

export function createPublisher() {
  return redisClient;
}

export function createSubscriber() {
  return redisClient;
}
`,
      },
    ]));

    const pubSubTest = result.tests.find((candidate) =>
      candidate.name === 'relays notifications through Redis Pub/Sub clients',
    );

    expect(pubSubTest?.status).toBe('failed');
    expect(result.output).toContain('FAIL relays notifications through Redis Pub/Sub clients');
  });

  test('fails shared Redis Pub/Sub factories even when other Redis clients exist', () => {
    const result = runSimulatedCommand('npm test', notificationWorkspaceWith(`import { checkRateLimit } from './rate-limit';
import { hasRecentlySent } from './idempotency';
import { createPublisher, createSubscriber } from './redis-client';
import { getUserProfile } from './models/userProfile';

export async function notify(req, res) {
  const userProfile = await getUserProfile(req.body.userId);
  if (userProfile.inAppEnabled === false) return res.status(202).json({ skipped: true });
  await checkRateLimit(req.body.userId, req.body.type);
  await hasRecentlySent(req.body.userId, req.body.id || req.body.message);
  await createPublisher().publish('notifications', JSON.stringify(req.body));
  return res.status(202).json({ accepted: true });
}

export function attachNotificationRelay(send) {
  const subscriber = createSubscriber();
  subscriber.subscribe('notifications');
  subscriber.on('message', (_channel, message) => send(JSON.parse(message)));
}
`, [
      {
        path: 'backend/src/redis-client.ts',
        language: 'typescript',
        content: `import Redis from 'ioredis';

const redisClient = new Redis(process.env.REDIS_URL);
const rateLimitClient = new Redis(process.env.REDIS_URL);
const idempotencyClient = new Redis(process.env.REDIS_URL);

export function createPublisher() {
  return redisClient;
}

export function createSubscriber() {
  return redisClient;
}

export { rateLimitClient, idempotencyClient };
`,
      },
    ]));

    const pubSubTest = result.tests.find((candidate) =>
      candidate.name === 'relays notifications through Redis Pub/Sub clients',
    );

    expect(pubSubTest?.status).toBe('failed');
  });
});
