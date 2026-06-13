import crypto from 'crypto';
import { db } from '../../lib/db';
import { tokenHash } from '../../lib/tokens';

export const PASSING_CART_TS = `export type CartItem = {
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

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error('Invalid quantity');
    }
  }
}

export function totalCents(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);
}
`;

export const PASSING_PAYMENT_TS = `type ChargeInput = {
  amountCents: number;
  customerId: string;
  idempotencyKey: string;
};

export async function chargeCard(input: ChargeInput) {
  if (input.amountCents <= 0) {
    throw new Error('Invalid charge amount');
  }

  return {
    id: 'pay_demo_123',
    status: 'succeeded',
    idempotencyKey: input.idempotencyKey,
  };
}
`;

export const PASSING_CHECKOUT_TS = `import { CartItem, totalCents, validateCart } from './cart';
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
  const idempotencyKey = [
    input.customerId,
    ...input.items.map((item) => item.sku + ':' + item.quantity),
  ].join('|');

  let payment;
  try {
    payment = await chargeCard({
      amountCents,
      customerId: input.customerId,
      idempotencyKey,
    });
  } catch (error) {
    await rollbackInventory(reservation.reservationId);
    throw error;
  }

  return createOrder(input, payment.id);
}
`;

export function uniqueTestEmail(prefix = 'candidate') {
  return `${prefix}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}@example.com`;
}

export async function getSeededAssessment() {
  const assessment = await db.assessment.findFirst({
    where: { title: 'Full-stack AI Collaboration Screen' },
    include: {
      workspace: true,
      challenge: {
        include: { files: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });

  if (!assessment) {
    throw new Error('Seeded assessment not found. Run npm run db:seed before tests.');
  }

  return assessment;
}

export async function createCandidateSessionFixture(input: {
  name?: string;
  email?: string;
  sessionToken?: string;
}) {
  const assessment = await getSeededAssessment();
  const now = new Date();
  const sessionToken = input.sessionToken || `test_sess_${crypto.randomBytes(16).toString('hex')}`;
  const candidate = await db.candidate.create({
    data: {
      workspaceId: assessment.workspaceId,
      name: input.name || 'Test Candidate',
      email: input.email || uniqueTestEmail(),
    },
  });

  const session = await db.candidateSession.create({
    data: {
      assessmentId: assessment.id,
      candidateId: candidate.id,
      sessionTokenHash: tokenHash(sessionToken),
      status: 'started',
      startedAt: now,
      expiresAt: new Date(now.getTime() + assessment.durationMinutes * 60 * 1000),
    },
  });

  await db.fileSnapshot.createMany({
    data: assessment.challenge.files.map((file) => ({
      sessionId: session.id,
      path: file.path,
      content: file.content,
      language: file.language,
      version: 1,
      source: 'starter',
    })),
  });

  return {
    assessment,
    candidate,
    session,
    sessionToken,
  };
}

export async function findSessionByToken(sessionToken: string) {
  return db.candidateSession.findUnique({
    where: { sessionTokenHash: tokenHash(sessionToken) },
    include: {
      candidate: true,
      evaluationReport: true,
    },
  });
}
