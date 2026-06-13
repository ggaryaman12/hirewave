import type { AiAssistantRequest, AiProviderResult } from '@/lib/ai/types';
import { buildTokenUsage } from '@/lib/ai/token-usage';
import {
  HIREWAVE_ASSISTANT_SYSTEM_PROMPT,
  buildAssistantPrompt,
  buildAssistantSafetyFlags,
  includedFiles,
  truncate,
} from '@/lib/ai/prompt';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type ReasoningEffort = 'low' | 'medium' | 'high';

export type OpenAiCompatibleConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  thinking: boolean;
  reasoningEffort: ReasoningEffort;
  timeoutMs: number;
  maxRetries: number;
};

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  top_p: number;
  max_tokens: number;
  chat_template_kwargs: { thinking: boolean; reasoning_effort: ReasoningEffort };
  stream: false;
};

// NVIDIA Build hosts every model behind one OpenAI-compatible endpoint. Defaults
// target the free-tier NVIDIA endpoint + deepseek-v4-flash, but any
// OpenAI-compatible base URL / model works via env.
const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_MODEL = 'deepseek-ai/deepseek-v4-flash';
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 1;
const DEFAULT_TOP_P = 0.95;
// Coaching surface defaults to low reasoning effort: fast replies, and Token
// Efficiency is a scored rubric dimension. High effort is reserved for the
// evaluator judge in a later sub-project.
const DEFAULT_REASONING_EFFORT: ReasoningEffort = 'low';
const DEFAULT_MAX_RETRIES = 1;
const MAX_REASONING_METADATA_CHARS = 8000;
const RETRY_BACKOFF_MS = 600;

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function toNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toReasoningEffort(value: string | undefined): ReasoningEffort {
  return value === 'low' || value === 'medium' || value === 'high' ? value : DEFAULT_REASONING_EFFORT;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readMessageString(message: Record<string, unknown> | undefined, key: string) {
  const value = message?.[key];
  return typeof value === 'string' ? value : '';
}

export function getOpenAiCompatibleConfig(): OpenAiCompatibleConfig {
  return {
    apiKey:
      process.env.AI_API_KEY ||
      process.env.NVIDIA_API_KEY ||
      process.env.OPENAI_API_KEY ||
      '',
    baseUrl: normalizeBaseUrl(
      process.env.AI_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      DEFAULT_BASE_URL,
    ),
    model: process.env.AI_MODEL || DEFAULT_MODEL,
    temperature: toNumber(process.env.AI_TEMPERATURE, DEFAULT_TEMPERATURE),
    topP: toNumber(process.env.AI_TOP_P, DEFAULT_TOP_P),
    maxTokens: toNumber(process.env.AI_MAX_TOKENS, DEFAULT_MAX_TOKENS),
    thinking: process.env.AI_THINKING !== 'false',
    reasoningEffort: toReasoningEffort(process.env.AI_REASONING_EFFORT),
    timeoutMs: toNumber(process.env.AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxRetries: toNumber(process.env.AI_MAX_RETRIES, DEFAULT_MAX_RETRIES),
  };
}

export function buildOpenAiCompatibleRequest(
  request: AiAssistantRequest,
  config: OpenAiCompatibleConfig,
): ChatCompletionRequest {
  return {
    model: config.model,
    messages: [
      { role: 'system', content: HIREWAVE_ASSISTANT_SYSTEM_PROMPT },
      { role: 'user', content: buildAssistantPrompt(request) },
    ],
    temperature: config.temperature,
    top_p: config.topP,
    max_tokens: config.maxTokens,
    chat_template_kwargs: { thinking: config.thinking, reasoning_effort: config.reasoningEffort },
    stream: false,
  };
}

async function fetchWithRetry(input: {
  url: string;
  body: string;
  apiKey: string;
  timeoutMs: number;
  maxRetries: number;
  fetchImpl: FetchLike;
}) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= input.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

    try {
      const response = await input.fetchImpl(input.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${input.apiKey}`,
          Accept: 'application/json',
        },
        body: input.body,
        signal: controller.signal,
      });

      // Retry only transient failures (rate limit / upstream errors).
      if ((response.status === 429 || response.status >= 500) && attempt < input.maxRetries) {
        await sleep(RETRY_BACKOFF_MS * (attempt + 1));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < input.maxRetries) {
        await sleep(RETRY_BACKOFF_MS * (attempt + 1));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('OpenAI-compatible request failed');
}

export async function generateOpenAiCompatibleAiResponse(input: {
  request: AiAssistantRequest;
  fetchImpl?: FetchLike;
  config?: OpenAiCompatibleConfig;
}): Promise<AiProviderResult> {
  const config = input.config || getOpenAiCompatibleConfig();
  if (!config.apiKey) {
    throw new Error('OpenAI-compatible provider missing AI_API_KEY');
  }

  const fetchImpl = input.fetchImpl || fetch;
  const requestBody = buildOpenAiCompatibleRequest(input.request, config);
  const prompt = requestBody.messages.map((message) => message.content).join('\n');
  const files = includedFiles(input.request);
  const startedAt = Date.now();
  const url = `${normalizeBaseUrl(config.baseUrl)}/chat/completions`;

  const response = await fetchWithRetry({
    url,
    body: JSON.stringify(requestBody),
    apiKey: config.apiKey,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
    fetchImpl,
  });

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(`OpenAI-compatible request failed (${response.status}): ${rawBody.slice(0, 500)}`);
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    throw new Error(`Non-JSON OpenAI-compatible response: ${rawBody.slice(0, 240)}`);
  }

  const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
  const firstChoice = (choices[0] || {}) as Record<string, unknown>;
  const message = (firstChoice.message || {}) as Record<string, unknown>;
  const content = readMessageString(message, 'content').trim();
  if (!content) throw new Error('OpenAI-compatible response missing message content.');

  // Chain-of-thought is captured for audit / future evaluator use, never shown
  // to the candidate (the route only returns `content`).
  const reasoning =
    readMessageString(message, 'reasoning') || readMessageString(message, 'reasoning_content');
  const usage = (parsed.usage || {}) as Record<string, unknown>;
  const model = typeof parsed.model === 'string' && parsed.model ? parsed.model : config.model;
  const latencyMs = Date.now() - startedAt;

  return {
    provider: 'openai-compatible',
    model,
    content,
    latencyMs,
    usage: {
      promptChars: prompt.length,
      responseChars: content.length,
      includedFiles: files.map((file) => file.path),
      ...buildTokenUsage({
        promptChars: prompt.length,
        responseChars: content.length,
        providerPromptTokens: usage.prompt_tokens,
        providerCompletionTokens: usage.completion_tokens,
      }),
    },
    safetyFlags: buildAssistantSafetyFlags(input.request),
    metadata: {
      configuredModel: config.model,
      baseUrl: config.baseUrl,
      reasoningEffort: config.reasoningEffort,
      finishReason: typeof firstChoice.finish_reason === 'string' ? firstChoice.finish_reason : undefined,
      reasoning: reasoning ? truncate(reasoning, MAX_REASONING_METADATA_CHARS) : undefined,
    },
  };
}
