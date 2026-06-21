import { db } from '@/lib/db';
import { toJson } from '@/lib/json';
import { WorkspaceRole } from '@/lib/constants';

export const DEFAULT_RUBRIC = [
  'Problem Decomposition',
  'First-Principles Thinking',
  'Creative Problem Solving',
  'Iteration Quality',
  'Debugging with AI',
  'Architecture Decisions',
  'Communication Clarity',
  'Token Efficiency',
];

export const DEFAULT_STACK = ['React', 'Node.js', 'Mock DB', 'Payments', 'Testing'];

export const DEFAULT_CHALLENGE_FILES = [
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

export async function ensureDemoWorkspace(userId: string) {
  const workspace = await db.workspace.upsert({
    where: { slug: 'hirewave-demo' },
    update: {},
    create: {
      name: 'Hirewave Demo Workspace',
      slug: 'hirewave-demo',
    },
  });

  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId,
      role: WorkspaceRole.OWNER,
    },
  });

  return workspace;
}

export async function ensureDefaultChallenge() {
  const challenge = await db.challenge.upsert({
    where: { slug: 'debug-broken-checkout-flow' },
    update: {
      title: 'Debug the Broken Checkout Flow',
      role: 'Full-stack Engineer',
      stackJson: toJson(DEFAULT_STACK),
      durationMinutes: 60,
      difficulty: 'Hard',
      scenario:
        'An e-commerce checkout has bugs across frontend validation, API error handling, database transaction logic, and payment flow.',
      instructions:
        'Inspect the starter files, use the AI assistant if helpful, run tests, fix the checkout behavior, and submit once the evidence supports the changes.',
      rubricJson: toJson(DEFAULT_RUBRIC),
    },
    create: {
      slug: 'debug-broken-checkout-flow',
      title: 'Debug the Broken Checkout Flow',
      role: 'Full-stack Engineer',
      stackJson: toJson(DEFAULT_STACK),
      durationMinutes: 60,
      difficulty: 'Hard',
      scenario:
        'An e-commerce checkout has bugs across frontend validation, API error handling, database transaction logic, and payment flow.',
      instructions:
        'Inspect the starter files, use the AI assistant if helpful, run tests, fix the checkout behavior, and submit once the evidence supports the changes.',
      rubricJson: toJson(DEFAULT_RUBRIC),
    },
  });

  for (const file of DEFAULT_CHALLENGE_FILES) {
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
