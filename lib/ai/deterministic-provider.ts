import type { WorkspaceFile } from '@/lib/sandbox/simulated-provider';

export function generateDeterministicAiResponse(input: {
  prompt: string;
  files: WorkspaceFile[];
}) {
  const prompt = input.prompt.toLowerCase();
  const activeFiles = input.files.map((file) => file.path).join(', ');
  const paths = new Set(input.files.map((file) => file.path));
  const isCheckoutChallenge = paths.has('src/cart.ts') && paths.has('src/payment.ts') && paths.has('src/checkout.ts');

  if (!isCheckoutChallenge) {
    if (prompt.includes('test') || prompt.includes('fail')) {
      return `Start by running the template tests, then map each failure back to README.md and src/solution-plan.ts. Replace TODO notes with a concrete root cause, risk controls, and verification evidence. Current files available: ${activeFiles}.`;
    }

    return 'Plan the fix in small steps: read README.md, inspect src/problem-context.ts, update src/solution-plan.ts with concrete reasoning, run tests, and then tighten the evidence before submitting.';
  }

  if (prompt.includes('test') || prompt.includes('fail')) {
    return `I would start by running the checkout tests, then map each failure back to the related file. In this challenge, inspect cart validation first, then payment idempotency, then checkout rollback/error handling. Current files available: ${activeFiles}.`;
  }

  if (prompt.includes('cart') || prompt.includes('quantity')) {
    return 'Look at `src/cart.ts`. A robust fix should reject non-finite, non-integer, zero, and negative quantities before totals are calculated. After changing it, rerun the tests to prove the behavior.';
  }

  if (prompt.includes('payment') || prompt.includes('idempot')) {
    return 'The payment layer needs an idempotency key in both the charge input type and the call site. Generate it from stable checkout inputs or pass it through the checkout flow, then verify the tests that inspect double-charge prevention.';
  }

  if (prompt.includes('rollback') || prompt.includes('inventory')) {
    return 'Wrap the payment/order path in a try/catch after inventory reservation. If payment fails, call `rollbackInventory(reservation.reservationId)` and rethrow the original error or a message that preserves payment context.';
  }

  return 'Plan the fix in small steps: read the failing area, make one change, run tests, then inspect the next failure. For this checkout challenge, the likely sequence is cart validation, payment idempotency, inventory rollback, and preserving useful errors.';
}
