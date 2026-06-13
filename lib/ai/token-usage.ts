export type TokenSource = 'provider' | 'estimated';

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tokenSource: TokenSource;
};

export function estimateTokenCountFromChars(chars: number) {
  return Math.max(1, Math.ceil(chars / 4));
}

function numeric(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function buildTokenUsage(input: {
  promptChars: number;
  responseChars: number;
  providerPromptTokens?: unknown;
  providerCompletionTokens?: unknown;
}): TokenUsage {
  const providerPromptTokens = numeric(input.providerPromptTokens);
  const providerCompletionTokens = numeric(input.providerCompletionTokens);

  if (providerPromptTokens !== null && providerCompletionTokens !== null) {
    return {
      promptTokens: providerPromptTokens,
      completionTokens: providerCompletionTokens,
      totalTokens: providerPromptTokens + providerCompletionTokens,
      tokenSource: 'provider',
    };
  }

  const promptTokens = estimateTokenCountFromChars(input.promptChars);
  const completionTokens = estimateTokenCountFromChars(input.responseChars);
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    tokenSource: 'estimated',
  };
}

export function readTokenUsage(value: unknown): TokenUsage | null {
  if (!value || typeof value !== 'object') return null;
  const usage = value as Record<string, unknown>;
  const promptTokens = numeric(usage.promptTokens);
  const completionTokens = numeric(usage.completionTokens);
  const totalTokens = numeric(usage.totalTokens);
  const tokenSource = usage.tokenSource === 'provider' ? 'provider' : 'estimated';

  if (promptTokens === null || completionTokens === null || totalTokens === null) return null;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    tokenSource,
  };
}

export function formatTokenUsage(usage: TokenUsage) {
  const suffix = usage.tokenSource === 'estimated' ? ' estimated' : '';
  return `${usage.totalTokens.toLocaleString()}${suffix} tokens`;
}
