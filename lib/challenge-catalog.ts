import crypto from 'crypto';
import { z } from 'zod';
import { approvedCustomDifficulty, isDraftDifficulty } from '@/lib/challenge-builder/templates';
import { validateChallengeDraftFiles } from '@/lib/challenge-builder/validation';
import { db } from '@/lib/db';
import { toJson } from '@/lib/json';

export const ENTERPRISE_RUBRIC = [
  'Problem Decomposition',
  'First-Principles Thinking',
  'Creative Problem Solving',
  'Iteration Quality',
  'Debugging with AI',
  'Architecture Decisions',
  'Communication Clarity',
  'Token Efficiency',
];

export const DEFAULT_CHALLENGE_SLUG = 'debug-broken-checkout-flow';

type CatalogFile = {
  path: string;
  language: string;
  sortOrder: number;
  content: string;
  isReadonly?: boolean;
};

type CatalogChallenge = {
  slug: string;
  title: string;
  role: string;
  stack: string[];
  durationMinutes: number;
  difficulty: string;
  scenario: string;
  instructions: string;
  files: CatalogFile[];
};

const checkoutFiles: CatalogFile[] = [
  {
    path: 'README.md',
    language: 'markdown',
    sortOrder: 0,
    content: `# Debug the Broken Checkout Flow

You inherited a small checkout module with several related bugs.

Your goal:

1. Reject invalid cart quantities before checkout.
2. Preserve useful API/payment errors for the caller.
3. Roll back reserved inventory when payment fails.
4. Prevent accidental double-charges by using an idempotency key.
5. Run the tests until the checkout behavior is stable.

You may use the AI assistant, but you are responsible for verifying its output.
`,
  },
  {
    path: 'src/cart.ts',
    language: 'typescript',
    sortOrder: 1,
    content: `export type CartItem = {
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

    // BUG: zero, negative, and non-integer quantities can still pass.
    if (item.quantity === undefined) {
      throw new Error('Missing quantity');
    }
  }
}

export function totalCents(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);
}
`,
  },
  {
    path: 'src/payment.ts',
    language: 'typescript',
    sortOrder: 2,
    content: `type ChargeInput = {
  amountCents: number;
  customerId: string;
};

export async function chargeCard(input: ChargeInput) {
  if (input.amountCents <= 0) {
    throw new Error('Invalid charge amount');
  }

  // BUG: provider needs an idempotency key to prevent double charges on retry.
  return {
    id: 'pay_demo_123',
    status: 'succeeded',
  };
}
`,
  },
  {
    path: 'src/checkout.ts',
    language: 'typescript',
    sortOrder: 3,
    content: `import { CartItem, totalCents, validateCart } from './cart';
import { chargeCard } from './payment';

type CheckoutInput = {
  customerId: string;
  items: CartItem[];
};

async function reserveInventory(items: CartItem[]) {
  return {
    reservationId: 'res_demo_123',
    items,
  };
}

async function createOrder(input: CheckoutInput, paymentId: string) {
  return {
    id: 'ord_demo_123',
    customerId: input.customerId,
    paymentId,
    items: input.items,
  };
}

async function rollbackInventory(reservationId: string) {
  return { reservationId, rolledBack: true };
}

export async function checkout(input: CheckoutInput) {
  validateCart(input.items);

  const reservation = await reserveInventory(input.items);
  const amountCents = totalCents(input.items);

  // BUG: payment failure skips rollback and hides the original failure.
  const payment = await chargeCard({
    amountCents,
    customerId: input.customerId,
  });

  return createOrder(input, payment.id);
}
`,
  },
  {
    path: 'tests/checkout.test.ts',
    language: 'typescript',
    sortOrder: 4,
    content: `import { checkout } from '../src/checkout';

describe('checkout', () => {
  it('rejects invalid quantities', async () => {
    await expect(checkout({
      customerId: 'cus_123',
      items: [{ sku: 'sku_1', quantity: 0, priceCents: 500 }],
    })).rejects.toThrow('quantity');
  });

  it('uses idempotent payment and preserves payment errors', async () => {
    // The platform test runner simulates payment provider failures.
  });

  it('rolls back inventory when payment fails', async () => {
    // The platform test runner inspects the checkout implementation.
  });
});
`,
  },
];

function genericTaskFiles(input: {
  title: string;
  domain: string;
  taskType: string;
  failureMode: string;
  context: string;
  focusSkills: string[];
}): CatalogFile[] {
  const focusSkillLines = input.focusSkills.map((skill, index) => `${index + 1}. ${skill}`).join('\n');

  return [
    {
      path: 'README.md',
      language: 'markdown',
      sortOrder: 0,
      content: `# ${input.title}

Domain: ${input.domain}

Task type: ${input.taskType}

Failure mode: ${input.failureMode}

Context:

${input.context}

Your goal:

1. Inspect the existing context before editing.
2. Explain the likely root cause in code.
3. Update the implementation notes with risk controls.
4. Record verification evidence that proves the behavior.
5. Run tests until the task evidence is stable.

Focus skills:

${focusSkillLines}

You may use the AI assistant, but you are responsible for verifying its output.
`,
    },
    {
      path: 'src/problem-context.ts',
      language: 'typescript',
      sortOrder: 1,
      content: `export const taskContext = {
  title: ${JSON.stringify(input.title)},
  domain: ${JSON.stringify(input.domain)},
  taskType: ${JSON.stringify(input.taskType)},
  failureMode: ${JSON.stringify(input.failureMode)},
  currentSymptom: ${JSON.stringify(input.context)},
  constraints: [
    'Keep the change deterministic.',
    'Do not rely on external services or production secrets.',
    'Preserve evidence for reviewer audit.',
  ],
};
`,
    },
    {
      path: 'src/solution-plan.ts',
      language: 'typescript',
      sortOrder: 2,
      content: `export const rootCause = 'TODO: explain the first unsafe behavior you found.';

export const riskControls = [
  'TODO: describe the first guardrail or invariant.',
  'TODO: describe the second guardrail or invariant.',
];

export const verificationEvidence = [
  'TODO: record the command, test, or inspection evidence used to verify the fix.',
];
`,
    },
    {
      path: 'tests/custom-task.test.ts',
      language: 'typescript',
      sortOrder: 3,
      content: `import { rootCause, riskControls, verificationEvidence } from '../src/solution-plan';

describe('custom task evidence', () => {
  it('documents a concrete root cause', () => {
    expect(rootCause).not.toContain('TODO');
    expect(rootCause.length).toBeGreaterThan(30);
  });

  it('records at least two risk controls', () => {
    expect(riskControls).toHaveLength(2);
    expect(riskControls.join(' ')).not.toContain('TODO');
  });

  it('records verification evidence', () => {
    expect(verificationEvidence.length).toBeGreaterThan(0);
    expect(verificationEvidence.join(' ')).not.toContain('TODO');
  });
});
`,
    },
  ];
}

const notificationSystemFiles: CatalogFile[] = [
  {
    path: 'BRIEF.md',
    language: 'markdown',
    sortOrder: 0,
    content: `# Real-time Notification System with Resilient Delivery

## Using Hirewave AI

You can use the Hirewave AI assistant in the assessment room to discuss architecture, inspect failure messages, and review code. The assistant should guide your thinking; you are still responsible for implementation and verification.

## Objective

Build a robust real-time notification system backend using Node.js and Redis Pub/Sub, then integrate it with an existing Next.js frontend. The system must handle rate limiting, ensure message idempotency, and gracefully manage client connection issues.

## Context

User engagement relies on timely and reliable notifications. This challenge asks you to enhance an existing notification capability so it can deliver real-time updates while preventing abuse and avoiding duplicate messages.

## Requirements

1. Backend Notification Service: implement a Node.js service exposing POST /notify to trigger notifications and publish accepted notifications to Redis Pub/Sub.
2. WebSocket Integration: relay Redis Pub/Sub notifications to connected frontend clients.
3. Rate Limiting: enforce 5 notifications per user per minute per notification type using Redis.
4. Notification Idempotency: prevent the same user from receiving the exact same notification more than once within 5 minutes.
5. Frontend Integration And Bug Fix: fix the dashboard duplicate WebSocket connection bug and display real-time notifications.
6. User Preferences: use the stubbed UserProfile service and send in-app notifications only when inAppEnabled is true.

## Evaluation Focus

- Problem decomposition across backend publishing, Redis, WebSocket relay, frontend consumption, rate limiting, idempotency, and preferences.
- First-principles reasoning about Redis Pub/Sub limits versus resilient delivery needs.
- Iteration quality while adding multiple features without breaking the existing frontend.
- Debugging approach for the duplicate WebSocket subscription bug.
- Architecture thinking across Node.js, Redis, WebSockets, Next.js, and stubbed MongoDB profile data.
- Communication clarity when asking AI for Redis/WebSocket/React hook help.
`,
  },
  {
    path: 'README.md',
    language: 'markdown',
    sortOrder: 1,
    content: `# Notification Workspace

Start by reading BRIEF.md. The starter code intentionally contains incomplete backend controls and a frontend duplicate-subscription bug.

Useful commands:

- npm test
- ls
- ls backend/src
- cat BRIEF.md
- cat backend/src/server.ts
- cat frontend/pages/dashboard.tsx

The current Hirewave runner is simulated. It validates key implementation signals instead of starting real Redis, MongoDB, or WebSocket servers.
`,
  },
  {
    path: 'backend/package.json',
    language: 'json',
    sortOrder: 2,
    content: JSON.stringify(
      {
        name: 'notification-backend',
        private: true,
        type: 'module',
        scripts: {
          dev: 'tsx src/server.ts',
          test: 'vitest run',
        },
        dependencies: {
          '@types/ws': '^8.5.12',
          dotenv: '^16.4.5',
          express: '^4.19.2',
          ioredis: '^5.4.1',
          mongoose: '^8.6.3',
          ws: '^8.18.0',
        },
        devDependencies: {
          tsx: '^4.19.1',
          typescript: '^5.6.3',
          vitest: '^2.1.1',
        },
      },
      null,
      2,
    ),
  },
  {
    path: 'backend/tsconfig.json',
    language: 'json',
    sortOrder: 3,
    content: JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
        include: ['src/**/*.ts'],
      },
      null,
      2,
    ),
  },
  {
    path: 'backend/.env.example',
    language: 'dotenv',
    sortOrder: 4,
    content: `PORT=3001
REDIS_URL=redis://localhost:6379
MONGO_URI=mongodb://localhost:27017/hirewave-notifications
`,
  },
  {
    path: 'backend/src/types.ts',
    language: 'typescript',
    sortOrder: 5,
    content: `export type NotificationPayload = {
  id?: string;
  userId: string;
  type: 'alert' | 'message' | 'system';
  message: string;
  timestamp: string;
};

export type AcceptedNotification = NotificationPayload & {
  id: string;
  streamId?: string;
  deliveredAt: string;
};
`,
  },
  {
    path: 'backend/src/redis-client.ts',
    language: 'typescript',
    sortOrder: 6,
    content: `import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// BUG: Pub/Sub subscribers should not share the same Redis connection used for commands.
// The current implementation exports only one client, which makes the relay fragile.
export const redisClient = new Redis(REDIS_URL);

export function createPublisher() {
  return redisClient;
}

export function createSubscriber() {
  return redisClient;
}
`,
  },
  {
    path: 'backend/src/models/userProfile.ts',
    language: 'typescript',
    sortOrder: 7,
    content: `export type UserProfile = {
  userId: string;
  inAppEnabled: boolean;
};

const profiles = new Map<string, UserProfile>([
  ['user-muted', { userId: 'user-muted', inAppEnabled: false }],
]);

export async function getUserProfile(userId: string): Promise<UserProfile> {
  return profiles.get(userId) || { userId, inAppEnabled: true };
}
`,
  },
  {
    path: 'backend/src/rate-limit.ts',
    language: 'typescript',
    sortOrder: 8,
    content: `import { redisClient } from './redis-client';

export async function checkRateLimit(userId: string, type: string) {
  const key = 'notification-rate:' + userId + ':' + type;

  // BUG: this only reads. It never increments, expires, or enforces the 5/minute limit.
  const current = await redisClient.get(key);
  return Number(current || 0) <= 5;
}
`,
  },
  {
    path: 'backend/src/idempotency.ts',
    language: 'typescript',
    sortOrder: 9,
    content: `import { redisClient } from './redis-client';
import type { NotificationPayload } from './types';

export async function shouldSendNotification(payload: NotificationPayload) {
  const key = 'notification-dedupe:' + payload.userId + ':' + payload.message;

  // BUG: this key is not hashed, not atomic, and does not set a 5-minute TTL.
  const existing = await redisClient.get(key);
  return !existing;
}
`,
  },
  {
    path: 'backend/src/server.ts',
    language: 'typescript',
    sortOrder: 10,
    content: `import express from 'express';
import { WebSocketServer } from 'ws';
import { createPublisher, createSubscriber } from './redis-client';
import { checkRateLimit } from './rate-limit';
import { shouldSendNotification } from './idempotency';
import { getUserProfile } from './models/userProfile';
import type { AcceptedNotification, NotificationPayload } from './types';

const app = express();
app.use(express.json());

const publisher = createPublisher();
const subscriber = createSubscriber();
const wss = new WebSocketServer({ port: 3002 });

const connectedClients = new Map<string, Set<WebSocket>>();

function makeNotificationId(payload: NotificationPayload) {
  return payload.id || payload.userId + ':' + payload.type + ':' + payload.timestamp;
}

app.post('/notify', async (req, res) => {
  const payload = req.body as NotificationPayload;

  // BUG: preferences, rate limiting, and idempotency are imported but not enforced correctly.
  await getUserProfile(payload.userId);
  await checkRateLimit(payload.userId, payload.type);
  await shouldSendNotification(payload);

  const notification: AcceptedNotification = {
    ...payload,
    id: makeNotificationId(payload),
    deliveredAt: new Date().toISOString(),
  };

  await publisher.publish('notifications', JSON.stringify(notification));
  return res.status(202).json({ accepted: true, notification });
});

subscriber.subscribe('notifications');
subscriber.on('message', (_channel, raw) => {
  const notification = JSON.parse(raw) as AcceptedNotification;
  const clients = connectedClients.get(notification.userId) || new Set();
  for (const client of clients) {
    client.send(JSON.stringify(notification));
  }
});

export { app, wss };
`,
  },
  {
    path: 'frontend/package.json',
    language: 'json',
    sortOrder: 11,
    content: JSON.stringify(
      {
        name: 'notification-frontend',
        private: true,
        scripts: {
          dev: 'next dev',
          test: 'vitest run',
        },
        dependencies: {
          next: '14.2.15',
          react: '^18.3.1',
          'react-dom': '^18.3.1',
        },
        devDependencies: {
          typescript: '^5.6.3',
          vitest: '^2.1.1',
        },
      },
      null,
      2,
    ),
  },
  {
    path: 'frontend/tsconfig.json',
    language: 'json',
    sortOrder: 12,
    content: JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          jsx: 'preserve',
          strict: true,
          moduleResolution: 'Bundler',
        },
        include: ['pages/**/*.tsx', 'components/**/*.tsx', 'utils/**/*.ts'],
      },
      null,
      2,
    ),
  },
  {
    path: 'frontend/.env.local.example',
    language: 'dotenv',
    sortOrder: 13,
    content: `NEXT_PUBLIC_WS_URL=ws://localhost:3002
`,
  },
  {
    path: 'frontend/utils/websocket.ts',
    language: 'typescript',
    sortOrder: 14,
    content: `export function connectNotifications(userId: string) {
  const url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002';
  const socket = new WebSocket(url + '?userId=' + encodeURIComponent(userId));
  return socket;
}
`,
  },
  {
    path: 'frontend/components/NotificationDisplay.tsx',
    language: 'typescript',
    sortOrder: 15,
    content: `type Notification = {
  id: string;
  type: string;
  message: string;
  timestamp: string;
};

export function mergeNotification(current: Notification[], incoming: Notification) {
  // BUG: append-only behavior shows duplicates when live and recovery paths overlap.
  return [incoming, ...current];
}

export function NotificationDisplay({ notifications }: { notifications: Notification[] }) {
  return (
    <ul>
      {notifications.map((notification) => (
        <li key={notification.id}>{notification.message}</li>
      ))}
    </ul>
  );
}
`,
  },
  {
    path: 'frontend/pages/dashboard.tsx',
    language: 'typescript',
    sortOrder: 16,
    content: `import { useEffect, useState } from 'react';
import { NotificationDisplay, mergeNotification } from '../components/NotificationDisplay';
import { connectNotifications } from '../utils/websocket';

export default function DashboardPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const userId = 'user123';

  // BUG: missing dependency array and cleanup creates duplicate WebSocket connections.
  useEffect(() => {
    const socket = connectNotifications(userId);
    socket.onmessage = (event) => {
      const next = JSON.parse(event.data);
      setNotifications((current) => mergeNotification(current, next));
    };
  });

  return <NotificationDisplay notifications={notifications} />;
}
`,
  },
  {
    path: 'tests/notification-system.test.ts',
    language: 'typescript',
    sortOrder: 17,
    content: `describe('notification system', () => {
  it('enforces per-user per-type rate limits', () => {
    // The Hirewave runner inspects backend/src/rate-limit.ts for Redis INCR/EXPIRE and a 5 per minute limit.
  });

  it('deduplicates notifications for five minutes', () => {
    // The Hirewave runner inspects backend/src/idempotency.ts for atomic Redis TTL-based dedupe.
  });

  it('does not send in-app notifications when user preferences disable them', () => {
    // The Hirewave runner inspects backend/src/server.ts for UserProfile preference checks.
  });

  it('does not duplicate frontend WebSocket subscriptions', () => {
    // The Hirewave runner inspects frontend/pages/dashboard.tsx for useEffect cleanup and stable dependencies.
  });

  it('deduplicates client display by canonical notification id', () => {
    // The Hirewave runner inspects NotificationDisplay merge behavior.
  });
});
`,
  },
];

function complexPlanningFiles(input: {
  title: string;
  domain: string;
  objective: string;
  context: string;
  requirements: string[];
  stack: string[];
  starterNotes: string[];
}): CatalogFile[] {
  const requirements = input.requirements.map((item, index) => `${index + 1}. ${item}`).join('\n');
  const starterNotes = input.starterNotes.map((item) => `- ${item}`).join('\n');

  return [
    {
      path: 'BRIEF.md',
      language: 'markdown',
      sortOrder: 0,
      content: `# ${input.title}

## Objective

${input.objective}

## Context

${input.context}

## Requirements

${requirements}

## Starter Files Scaffold

${starterNotes}

## Evaluation Criteria

- Break the work into data flow, validation, failure handling, and user-facing behavior.
- Use the AI assistant to reason through trade-offs, but verify every suggestion.
- Record a concrete root cause, risk controls, and verification evidence in src/solution-plan.ts.
- Run tests before submitting.
`,
    },
    ...genericTaskFiles({
      title: input.title,
      domain: input.domain,
      taskType: 'Complex project slice',
      failureMode: input.requirements[0] || 'Multi-step failure mode',
      context: input.context,
      focusSkills: ['System design', 'Debugging', 'Data modeling', 'Verification'],
    }).map((file) => ({
      ...file,
      sortOrder: file.sortOrder + 1,
    })),
    {
      path: 'backend/src/service.ts',
      language: 'typescript',
      sortOrder: 10,
      content: `export async function handleRequest(input: unknown) {
  return {
    accepted: true,
    input,
  };
}
`,
    },
    {
      path: 'backend/src/repository.ts',
      language: 'typescript',
      sortOrder: 11,
      content: `export const records: unknown[] = [];

export async function saveRecord(record: unknown) {
  records.push(record);
  return record;
}
`,
    },
    {
      path: 'frontend/components/ReviewPanel.tsx',
      language: 'typescript',
      sortOrder: 12,
      content: `export function ReviewPanel({ items }: { items: unknown[] }) {
  return (
    <section>
      <h2>Review</h2>
      <pre>{JSON.stringify(items, null, 2)}</pre>
    </section>
  );
}
`,
    },
    {
      path: 'tests/project-slice.test.ts',
      language: 'typescript',
      sortOrder: 13,
      content: `import { rootCause, riskControls, verificationEvidence } from '../src/solution-plan';

describe('project slice evidence', () => {
  it('captures root cause, risk controls, and verification evidence', () => {
    expect(rootCause).not.toContain('TODO');
    expect(riskControls.length).toBeGreaterThanOrEqual(2);
    expect(verificationEvidence.length).toBeGreaterThanOrEqual(1);
  });
});
`,
    },
  ];
}

export const CHALLENGE_CATALOG: CatalogChallenge[] = [
  {
    slug: DEFAULT_CHALLENGE_SLUG,
    title: 'Debug the Broken Checkout Flow',
    role: 'Full-stack Engineer',
    stack: ['React', 'Node.js', 'Mock DB', 'Payments', 'Testing'],
    durationMinutes: 60,
    difficulty: 'Hard',
    scenario:
      'An e-commerce checkout has bugs across frontend validation, API error handling, database transaction logic, and payment flow.',
    instructions:
      'Inspect the starter files, use the AI assistant if helpful, run tests, fix the checkout behavior, and submit once the evidence supports the changes.',
    files: checkoutFiles,
  },
  {
    slug: 'real-time-notification-resilient-delivery',
    title: 'Real-time Notification System With Resilient Delivery',
    role: 'Full-stack Engineer',
    stack: ['Node.js', 'TypeScript', 'Redis Pub/Sub', 'WebSockets', 'Next.js', 'Testing'],
    durationMinutes: 90,
    difficulty: 'Hard',
    scenario:
      'A product team needs real-time in-app notifications, but the current backend lacks resilient Redis Pub/Sub boundaries, rate limits, idempotency, preference checks, and the frontend opens duplicate WebSocket connections.',
    instructions:
      'Read BRIEF.md, then make the notification service realistic: publish accepted notifications through Redis Pub/Sub, relay them over WebSockets, enforce rate limiting and idempotency, respect the UserProfile preference stub, fix the duplicate WebSocket connection bug, and keep verification evidence in tests/notification-system.test.ts.',
    files: notificationSystemFiles,
  },
  {
    slug: 'robust-activity-log-ingestion-deduplication',
    title: 'Robust Activity Log Ingestion And Deduplication',
    role: 'Backend Engineer',
    stack: ['TypeScript', 'Node.js', 'PostgreSQL', 'Queue workers', 'Testing'],
    durationMinutes: 90,
    difficulty: 'Hard',
    scenario:
      'A compliance dashboard receives bursty activity events from multiple services. Retries and partial failures create duplicate audit rows, while malformed events can block the whole batch.',
    instructions:
      'Build a candidate-facing ingestion slice with schema validation, deterministic event identity, batch-level partial failure handling, deduplication, and reviewer-visible verification evidence. Keep the focus on auditability and failure isolation rather than production-scale infrastructure.',
    files: complexPlanningFiles({
      title: 'Robust Activity Log Ingestion And Deduplication',
      domain: 'Compliance audit logging',
      objective:
        'Create a reliable activity-log ingestion path that accepts batches, rejects malformed rows without dropping valid rows, and prevents duplicate persisted audit events.',
      context:
        'Several product services send activity events to a shared audit log. Network retries reuse payloads, some producers omit optional metadata, and the current all-or-nothing ingestion path either duplicates records or loses reviewable failure details.',
      requirements: [
        'Define a stable idempotency key for each activity event and use it for deduplication.',
        'Persist valid events while returning a structured partial-failure report for rejected rows.',
        'Separate validation, repository writes, and queue retry decisions so failures are reviewable.',
        'Preserve ordering or causal metadata needed by the compliance dashboard.',
        'Record verification evidence for duplicate batches, malformed rows, and retry behavior.',
      ],
      stack: ['TypeScript', 'Node.js', 'PostgreSQL', 'Queue workers', 'Testing'],
      starterNotes: [
        'backend/src/service.ts is the ingestion boundary candidates should harden.',
        'backend/src/repository.ts represents persisted audit rows and should become idempotent.',
        'frontend/components/ReviewPanel.tsx is a lightweight reviewer view for accepted and rejected rows.',
        'tests/project-slice.test.ts expects root cause, risk controls, and verification evidence.',
      ],
    }),
  },
  {
    slug: 'personalized-feed-cache-ab-test',
    title: 'Personalized Feed Cache And A/B Test',
    role: 'Product Engineer',
    stack: ['Next.js', 'TypeScript', 'Redis', 'Experimentation', 'Testing'],
    durationMinutes: 90,
    difficulty: 'Hard',
    scenario:
      'A personalized feed rollout is mixing experiment variants because cache keys ignore user segment and A/B assignment. Users see stale recommendations and analysts cannot trust exposure data.',
    instructions:
      'Build a project-style feed slice that scopes cache entries by user, segment, and A/B variant; records exposure evidence; defines safe fallback behavior; and explains how the implementation avoids stale or cross-variant feed leakage.',
    files: complexPlanningFiles({
      title: 'Personalized Feed Cache And A/B Test',
      domain: 'Personalization platform',
      objective:
        'Stabilize a personalized feed path so cached recommendations respect segment and A/B assignment while still giving users a fast fallback when ranking is unavailable.',
      context:
        'The feed service caches recommendations aggressively. During an experiment launch, users assigned to variant B can receive variant A results, and exposure events are not consistently tied to the feed response they saw.',
      requirements: [
        'Design cache keys that include user identity, segment, locale, and experiment variant.',
        'Record one exposure event per served feed variant without double-counting refreshes.',
        'Define fallback behavior for ranker failure without leaking another variant.',
        'Show how stale cache invalidation should work when user preferences change.',
        'Record verification evidence for cache separation, exposure idempotency, and fallback behavior.',
      ],
      stack: ['Next.js', 'TypeScript', 'Redis', 'Experimentation', 'Testing'],
      starterNotes: [
        'backend/src/service.ts represents the feed resolver and cache policy boundary.',
        'backend/src/repository.ts can store exposure events or cached feed records.',
        'frontend/components/ReviewPanel.tsx should make the active variant and evidence visible.',
        'tests/project-slice.test.ts expects root cause, risk controls, and verification evidence.',
      ],
    }),
  },
  {
    slug: 'webhook-idempotency-order-state',
    title: 'Webhook Idempotency And Order State',
    role: 'Backend Engineer',
    stack: ['TypeScript', 'Node.js', 'Payments', 'State machines', 'Testing'],
    durationMinutes: 75,
    difficulty: 'Hard',
    scenario:
      'A payment gateway sends duplicate and out-of-order webhook events. Some orders are confirmed twice and refund events are inconsistently audited.',
    instructions:
      'Trace the webhook handler, state transition rules, and audit event path. Add a safe idempotency plan and verification evidence for duplicate and stale events.',
    files: genericTaskFiles({
      title: 'Webhook Idempotency And Order State',
      domain: 'Payments',
      taskType: 'Bug fix',
      failureMode: 'Duplicate and out-of-order webhook events',
      context:
        'The payment provider retries succeeded webhooks. The current system does not clearly separate new events, duplicate events, and stale events.',
      focusSkills: ['State transition reasoning', 'Idempotency design', 'Audit-friendly debugging'],
    }),
  },
  {
    slug: 'multi-tenant-permission-leak',
    title: 'Multi-Tenant Permission Leak',
    role: 'Full-stack Engineer',
    stack: ['Next.js', 'TypeScript', 'Authorization', 'SQL', 'Testing'],
    durationMinutes: 75,
    difficulty: 'Hard',
    scenario:
      'A workspace manager can open a report from another workspace by changing an ID in the URL. The UI hides it, but the server query is under-scoped.',
    instructions:
      'Find the first unsafe server boundary, explain the authorization gap, and record tests or inspection evidence for same-workspace and cross-workspace access.',
    files: genericTaskFiles({
      title: 'Multi-Tenant Permission Leak',
      domain: 'SaaS authorization',
      taskType: 'Bug fix',
      failureMode: 'Cross-workspace report access',
      context:
        'Report list filtering appears correct, but direct report-detail URLs can expose another workspace if the repository query forgets workspace scope.',
      focusSkills: ['Authorization boundaries', 'Query scoping', 'Regression test design'],
    }),
  },
  {
    slug: 'inventory-reservation-race',
    title: 'Inventory Reservation Race Condition',
    role: 'Backend Engineer',
    stack: ['TypeScript', 'Transactions', 'Commerce', 'Concurrency', 'Testing'],
    durationMinutes: 90,
    difficulty: 'Hard',
    scenario:
      'Two customers can buy the last unit at the same time because availability is checked before payment without an atomic reservation boundary.',
    instructions:
      'Reason through the read-check-write race, define a safer reservation invariant, and record how concurrent attempts should be verified.',
    files: genericTaskFiles({
      title: 'Inventory Reservation Race Condition',
      domain: 'Commerce',
      taskType: 'Reliability bug',
      failureMode: 'Concurrent checkout oversells inventory',
      context:
        'The code checks stock, then reserves it later. Two sessions can pass the check before either reservation is committed.',
      focusSkills: ['Concurrency reasoning', 'Transaction boundaries', 'Failure rollback'],
    }),
  },
  {
    slug: 'csv-import-partial-failure',
    title: 'CSV Import With Partial Failure Report',
    role: 'Product Engineer',
    stack: ['TypeScript', 'CSV parsing', 'Validation', 'Product UX', 'Testing'],
    durationMinutes: 60,
    difficulty: 'Medium-Hard',
    scenario:
      'A bulk candidate import fails the whole file when one row has an invalid email. Valid rows should import and invalid rows should be reported clearly.',
    instructions:
      'Design row-level validation and a partial-failure summary that preserves valid records while making rejected rows reviewable.',
    files: genericTaskFiles({
      title: 'CSV Import With Partial Failure Report',
      domain: 'Data import',
      taskType: 'Feature extension',
      failureMode: 'Single bad row blocks the entire import',
      context:
        'Hiring teams upload CSV files with candidate details. The current all-or-nothing import loses useful rows and gives vague errors.',
      focusSkills: ['Data validation', 'Product error design', 'Idempotent imports'],
    }),
  },
  {
    slug: 'ai-assistant-guardrail-regression',
    title: 'AI Assistant Guardrail Regression',
    role: 'AI Product Engineer',
    stack: ['TypeScript', 'AI policy', 'Prompt safety', 'Route handlers', 'Testing'],
    durationMinutes: 75,
    difficulty: 'Hard',
    scenario:
      'The candidate asks the assistant to solve the entire task. The assistant gives a direct patch and claims it ran tests, which violates the assessment boundary.',
    instructions:
      'Preserve useful coaching while preventing direct file-edit requests, fake execution claims, and evaluator-logic leakage.',
    files: genericTaskFiles({
      title: 'AI Assistant Guardrail Regression',
      domain: 'AI assessment policy',
      taskType: 'Guardrail hardening',
      failureMode: 'Assistant crosses from coaching into doing the assessment',
      context:
        'The assistant should help candidates reason and verify, but it must not claim command execution, reveal scoring internals, or provide a complete patch on request.',
      focusSkills: ['AI boundary design', 'False-positive testing', 'Candidate experience'],
    }),
  },
];

const customChallengeDraftSchema = z.object({
  title: z.string().trim().min(3).max(120),
  role: z.string().trim().min(2).max(80),
  seniority: z.string().trim().min(2).max(40),
  taskType: z.string().trim().min(2).max(80),
  domain: z.string().trim().min(2).max(80),
  durationMinutes: z.coerce.number().int().min(30).max(240),
  stack: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
  failureMode: z.string().trim().min(3).max(120),
  focusSkills: z.array(z.string().trim().min(2).max(80)).min(1).max(6),
  context: z.string().trim().min(20).max(1000),
});

export type CustomChallengeDraftInput = z.input<typeof customChallengeDraftSchema>;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function uniqueCustomSlug(title: string) {
  const suffix = crypto.randomBytes(4).toString('hex');
  return `custom-${slugify(title) || 'task'}-${suffix}`;
}

async function upsertCatalogChallenge(template: CatalogChallenge) {
  const challenge = await db.challenge.upsert({
    where: { slug: template.slug },
    update: {
      title: template.title,
      role: template.role,
      stackJson: toJson(template.stack),
      durationMinutes: template.durationMinutes,
      difficulty: template.difficulty,
      scenario: template.scenario,
      instructions: template.instructions,
      rubricJson: toJson(ENTERPRISE_RUBRIC),
    },
    create: {
      slug: template.slug,
      title: template.title,
      role: template.role,
      stackJson: toJson(template.stack),
      durationMinutes: template.durationMinutes,
      difficulty: template.difficulty,
      scenario: template.scenario,
      instructions: template.instructions,
      rubricJson: toJson(ENTERPRISE_RUBRIC),
    },
  });

  await db.challengeFile.deleteMany({
    where: {
      challengeId: challenge.id,
      path: { notIn: template.files.map((file) => file.path) },
    },
  });

  for (const file of template.files) {
    await db.challengeFile.upsert({
      where: { challengeId_path: { challengeId: challenge.id, path: file.path } },
      update: file,
      create: {
        challengeId: challenge.id,
        ...file,
      },
    });
  }

  return challenge;
}

export async function ensureChallengeCatalog() {
  const ensured = [];

  for (const template of CHALLENGE_CATALOG) {
    ensured.push(await upsertCatalogChallenge(template));
  }

  return ensured;
}

export async function ensureDefaultChallenge() {
  await ensureChallengeCatalog();
  const challenge = await db.challenge.findUnique({ where: { slug: DEFAULT_CHALLENGE_SLUG } });
  if (!challenge) {
    throw new Error('Default challenge was not created.');
  }
  return challenge;
}

export async function createCustomChallengeDraft(input: CustomChallengeDraftInput) {
  const parsed = customChallengeDraftSchema.parse(input);
  const slug = uniqueCustomSlug(parsed.title);
  const files = genericTaskFiles({
    title: parsed.title,
    domain: parsed.domain,
    taskType: parsed.taskType,
    failureMode: parsed.failureMode,
    context: parsed.context,
    focusSkills: parsed.focusSkills,
  });

  const challenge = await db.challenge.create({
    data: {
      slug,
      title: parsed.title,
      role: parsed.role,
      stackJson: toJson(parsed.stack),
      durationMinutes: parsed.durationMinutes,
      difficulty: `Draft - ${parsed.seniority}`,
      scenario:
        `${parsed.domain} ${parsed.taskType.toLowerCase()} task for a ${parsed.seniority} ${parsed.role}. ` +
        `Primary failure mode: ${parsed.failureMode}.`,
      instructions:
        `${parsed.context}\n\nPrimary failure mode: ${parsed.failureMode}.\n\n` +
        `Generated as a controlled draft template. Review the brief, starter files, and tests before using this with candidates.`,
      rubricJson: toJson(ENTERPRISE_RUBRIC),
      files: {
        create: files.map((file) => ({ ...file })),
      },
    },
  });

  return challenge;
}

export async function approveCustomChallengeDraft(challengeId: string) {
  const challenge = await db.challenge.findUnique({
    where: { id: challengeId },
    include: { files: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!challenge) {
    throw new Error('Custom challenge draft does not exist.');
  }
  if (!isDraftDifficulty(challenge.difficulty)) {
    return challenge;
  }

  const validation = validateChallengeDraftFiles(challenge.files);
  if (validation.status === 'blocked') {
    throw new Error(
      `Custom challenge draft cannot be approved until validation errors are fixed: ${
        validation.issues
          .filter((issue) => issue.severity === 'error')
          .map((issue) => issue.message)
          .join(' ')
      }`,
    );
  }

  return db.challenge.update({
    where: { id: challenge.id },
    data: {
      difficulty: approvedCustomDifficulty(challenge.difficulty),
      instructions: [
        challenge.instructions,
        '',
        'Approval gate:',
        `Approved as a controlled custom template after draft validation. Allowed commands: ${validation.allowedCommands.join(', ')}.`,
        `Validation warnings: ${validation.warningCount}.`,
      ].join('\n'),
    },
    include: { files: { orderBy: { sortOrder: 'asc' } } },
  });
}
