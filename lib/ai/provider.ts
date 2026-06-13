import { generateOllamaAiResponse } from '@/lib/ai/ollama-provider';
import { generateOpenAiCompatibleAiResponse } from '@/lib/ai/openai-compatible-provider';
import { buildTokenUsage } from '@/lib/ai/token-usage';
import type { AiAssistantRequest, AiProviderName, AiProviderResult } from '@/lib/ai/types';

// ============================================================================
// MASTER AI FLOW SWITCH
// ----------------------------------------------------------------------------
// Single place to choose which assistant flow runs. Flip this one value:
//   'openai-compatible' -> NEW flow: NVIDIA Build / OpenAI-compatible endpoint
//   'ollama'            -> EXISTING flow: Yelo-hosted Ollama endpoint
//   'deterministic'     -> local rule-based responses (used by tests)
// The AI_PROVIDER env var, when set, OVERRIDES this switch (so tests can force
// deterministic and prod can override per-deploy without a code change).
// ============================================================================
export const AI_FLOW_MASTER_SWITCH: AiProviderName = 'openai-compatible';

function resolveProvider(): string {
  return (process.env.AI_PROVIDER || AI_FLOW_MASTER_SWITCH).toLowerCase();
}

function includedFiles(request: AiAssistantRequest) {
  const selectedPath = request.workspace.selectedFilePath;
  const selected = request.workspace.files.filter((file) => file.path === selectedPath || file.isSelected);
  const recentlyEdited = request.workspace.files.filter((file) => file.isRecentlyEdited);
  const fallback = request.workspace.files.slice(0, 2);
  const paths = [...selected, ...recentlyEdited, ...fallback].map((file) => file.path);

  return Array.from(new Set(paths));
}

function buildSafetyFlags(request: AiAssistantRequest) {
  const message = request.candidateMessage.toLowerCase();
  const flags: string[] = [];

  if (/\b(score|grade|evaluate|rating|hire|recommendation)\b/.test(message)) {
    flags.push('candidate_requested_evaluation');
  }

  if (/\b(secret|token|password|credential|api key)\b/.test(message)) {
    flags.push('candidate_requested_sensitive_data');
  }

  return flags;
}

function isCheckoutChallenge(request: AiAssistantRequest) {
  const paths = new Set(request.workspace.files.map((file) => file.path));
  return paths.has('src/cart.ts') && paths.has('src/payment.ts') && paths.has('src/checkout.ts');
}

function generateDeterministicAssistantContent(request: AiAssistantRequest) {
  const message = request.candidateMessage.toLowerCase();
  const activeFiles = includedFiles(request).join(', ');
  const latestTestSummary = request.activity.latestTestSummary;
  const commandHint = request.activity.recentCommands[0]?.command;
  const checkoutChallenge = isCheckoutChallenge(request);

  if (!checkoutChallenge) {
    if (message.includes('test') || message.includes('fail')) {
      return [
        'Start in the Terminal / tests panel with `npm test`, then map the first failing check back to the task brief and current implementation notes.',
        'For this template, inspect `README.md`, `src/problem-context.ts`, and `src/solution-plan.ts` before editing.',
        latestTestSummary ? `Latest test evidence in the session: ${latestTestSummary}.` : undefined,
        commandHint ? `The recent command context is ${commandHint}; rerun the relevant test after each small change.` : undefined,
        `Current files available: ${activeFiles}.`,
      ].filter(Boolean).join(' ');
    }

    if (message.includes('webhook') || message.includes('idempot')) {
      return 'Focus on event identity, order state transitions, and audit behavior. Use `cat src/problem-context.ts` and `cat src/solution-plan.ts`, then record the root cause, risk controls, and verification evidence before rerunning `npm test`.';
    }

    if (message.includes('permission') || message.includes('workspace') || message.includes('auth')) {
      return 'Trace the server boundary first: route handler, permission helper, and data query. The fix should happen at the API/query layer, not only in UI filtering. Record same-workspace and cross-workspace verification evidence.';
    }

    return 'Start with terminal evidence: run `ls src`, inspect `README.md` and `src/solution-plan.ts`, then run `npm test`. Replace TODO notes with a concrete root cause, at least two risk controls, and verification evidence tied to the failure mode.';
  }

  if (message.includes('test') || message.includes('fail')) {
    return [
      'Start in the Terminal / tests panel with `npm test` for the checkout tests, then map each failure back to the related file.',
      'Inspect cart validation first, then payment idempotency, then checkout rollback/error handling.',
      latestTestSummary ? `Latest test evidence in the session: ${latestTestSummary}.` : undefined,
      commandHint ? `The recent command context is ${commandHint}; rerun the relevant test after each small fix.` : undefined,
      `Current files available: ${activeFiles}.`,
    ].filter(Boolean).join(' ');
  }

  if (message.includes('cart') || message.includes('quantity')) {
    return 'Run `cat src/cart.ts` in the terminal or open `src/cart.ts` in the file tree. A robust fix should reject non-finite, non-integer, zero, and negative quantities before totals are calculated. After changing it, run `npm test` to prove the behavior.';
  }

  if (message.includes('payment') || message.includes('idempot')) {
    return 'Inspect `src/payment.ts` with `cat src/payment.ts`. The payment layer needs an idempotency key in both the charge input type and the call site. Generate it from stable checkout inputs or pass it through the checkout flow, then verify with `npm test`.';
  }

  if (message.includes('rollback') || message.includes('inventory')) {
    return 'Inspect `src/checkout.ts` with `cat src/checkout.ts`. Wrap the payment/order path in a try/catch after inventory reservation. If payment fails, call `rollbackInventory(reservation.reservationId)` and rethrow the original error or a message that preserves payment context.';
  }

  return 'Start with terminal evidence: run `ls src`, then `cat src/cart.ts`, then `npm test`. After the first failure is clear, make one small edit and rerun `npm test`. For this checkout challenge, the likely sequence is cart validation, payment idempotency, inventory rollback, and preserving useful errors.';
}

function generateDeterministicAiResponse(request: AiAssistantRequest): AiProviderResult {
  const startedAt = Date.now();
  const content = generateDeterministicAssistantContent(request);
  const files = includedFiles(request);

  return {
    provider: 'deterministic',
    model: 'deterministic-hirewave-mvp',
    content,
    latencyMs: Date.now() - startedAt,
    usage: {
      promptChars: request.candidateMessage.length,
      responseChars: content.length,
      includedFiles: files,
      ...buildTokenUsage({
        promptChars: request.candidateMessage.length,
        responseChars: content.length,
      }),
    },
    safetyFlags: buildSafetyFlags(request),
    metadata: {},
  };
}

export async function generateAiAssistantResponse(request: AiAssistantRequest): Promise<AiProviderResult> {
  const provider = resolveProvider();

  if (provider === 'ollama') {
    return generateOllamaAiResponse({ request });
  }

  // `nvidia` is an alias for the generic OpenAI-compatible provider, which
  // targets the NVIDIA Build endpoint by default but works with any
  // OpenAI-compatible base URL / model.
  if (provider === 'openai-compatible' || provider === 'nvidia') {
    return generateOpenAiCompatibleAiResponse({ request });
  }

  return generateDeterministicAiResponse(request);
}
