const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { seedDsa } = require('./seed-dsa');

const prisma = new PrismaClient();

const stack = ['React', 'Node.js', 'Mock DB', 'Payments', 'Testing'];

const rubric = [
  'Problem Decomposition',
  'First-Principles Thinking',
  'Creative Problem Solving',
  'Iteration Quality',
  'Debugging with AI',
  'Architecture Decisions',
  'Communication Clarity',
  'Token Efficiency',
];

const files = [
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

function genericTaskFiles(input) {
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

const additionalChallenges = [
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

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function main() {
  const user = await prisma.user.upsert({
    where: { email: process.env.DEMO_USER_EMAIL || 'founder@hirewave.local' },
    update: {},
    create: {
      name: 'Demo Founder',
      email: process.env.DEMO_USER_EMAIL || 'founder@hirewave.local',
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'hirewave-demo' },
    update: {},
    create: {
      name: 'Hirewave Demo Workspace',
      slug: 'hirewave-demo',
    },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: 'owner',
    },
  });

  const challenge = await prisma.challenge.upsert({
    where: { slug: 'debug-broken-checkout-flow' },
    update: {
      title: 'Debug the Broken Checkout Flow',
      role: 'Full-stack Engineer',
      stackJson: JSON.stringify(stack),
      durationMinutes: 60,
      difficulty: 'Hard',
      scenario:
        'An e-commerce checkout has bugs across frontend validation, API error handling, database transaction logic, and payment flow.',
      instructions:
        'Inspect the starter files, use the AI assistant if helpful, run tests, fix the checkout behavior, and submit once the evidence supports the changes.',
      rubricJson: JSON.stringify(rubric),
    },
    create: {
      slug: 'debug-broken-checkout-flow',
      title: 'Debug the Broken Checkout Flow',
      role: 'Full-stack Engineer',
      stackJson: JSON.stringify(stack),
      durationMinutes: 60,
      difficulty: 'Hard',
      scenario:
        'An e-commerce checkout has bugs across frontend validation, API error handling, database transaction logic, and payment flow.',
      instructions:
        'Inspect the starter files, use the AI assistant if helpful, run tests, fix the checkout behavior, and submit once the evidence supports the changes.',
      rubricJson: JSON.stringify(rubric),
    },
  });

  for (const file of files) {
    await prisma.challengeFile.upsert({
      where: { challengeId_path: { challengeId: challenge.id, path: file.path } },
      update: file,
      create: {
        challengeId: challenge.id,
        ...file,
      },
    });
  }

  for (const template of additionalChallenges) {
    const catalogChallenge = await prisma.challenge.upsert({
      where: { slug: template.slug },
      update: {
        title: template.title,
        role: template.role,
        stackJson: JSON.stringify(template.stack),
        durationMinutes: template.durationMinutes,
        difficulty: template.difficulty,
        scenario: template.scenario,
        instructions: template.instructions,
        rubricJson: JSON.stringify(rubric),
      },
      create: {
        slug: template.slug,
        title: template.title,
        role: template.role,
        stackJson: JSON.stringify(template.stack),
        durationMinutes: template.durationMinutes,
        difficulty: template.difficulty,
        scenario: template.scenario,
        instructions: template.instructions,
        rubricJson: JSON.stringify(rubric),
      },
    });

    await prisma.challengeFile.deleteMany({
      where: {
        challengeId: catalogChallenge.id,
        path: { notIn: template.files.map((file) => file.path) },
      },
    });

    for (const file of template.files) {
      await prisma.challengeFile.upsert({
        where: { challengeId_path: { challengeId: catalogChallenge.id, path: file.path } },
        update: file,
        create: {
          challengeId: catalogChallenge.id,
          ...file,
        },
      });
    }
  }

  let assessment = await prisma.assessment.findFirst({
    where: { workspaceId: workspace.id, challengeId: challenge.id, title: 'Full-stack AI Collaboration Screen' },
  });

  if (!assessment) {
    assessment = await prisma.assessment.create({
      data: {
        workspaceId: workspace.id,
        challengeId: challenge.id,
        createdById: user.id,
        title: 'Full-stack AI Collaboration Screen',
        role: 'Full-stack Engineer',
        seniority: 'Mid-Senior',
        durationMinutes: 60,
        aiMode: 'allowed',
        allowedToolsJson: JSON.stringify(['Hirewave AI assistant', 'Terminal', 'Test runner']),
        rubricJson: JSON.stringify(rubric),
        status: 'active',
      },
    });
  } else {
    assessment = await prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        rubricJson: JSON.stringify(rubric),
      },
    });
  }

  const token = 'demo-invite';
  await prisma.inviteLink.upsert({
    where: { tokenHash: tokenHash(token) },
    update: {
      assessmentId: assessment.id,
      publicToken: token,
      label: 'Demo invite',
      status: 'active',
    },
    create: {
      assessmentId: assessment.id,
      tokenHash: tokenHash(token),
      publicToken: token,
      label: 'Demo invite',
      status: 'active',
    },
  });

  // Slice 3: seed the DSA problem bank using the same prisma client instance.
  await seedDsa(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
