import type { AiAssistantRequest, AiProviderResult } from '@/lib/ai/types';
import { buildTokenUsage } from '@/lib/ai/token-usage';
import {
  HIREWAVE_ASSISTANT_SYSTEM_PROMPT,
  buildAssistantPrompt,
  buildAssistantSafetyFlags,
  includedFiles,
} from '@/lib/ai/prompt';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type OllamaProviderConfig = {
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

type OllamaGenerateRequest = {
  model: string;
  system: string;
  prompt: string;
  stream: false;
};

const DEFAULT_OLLAMA_BASE_URL = 'http://yeloai.yelo.solutions';
const DEFAULT_OLLAMA_MODEL = 'minimax-m2.5:cloud';
const DEFAULT_TIMEOUT_MS = 30000;

// Retained for backward compatibility; the prompt now lives in lib/ai/prompt.ts
// and is shared by every hosted provider.
export const HIREWAVE_OLLAMA_SYSTEM_PROMPT = HIREWAVE_ASSISTANT_SYSTEM_PROMPT;

// Retained export. buildOllamaPrompt is the shared assessment prompt builder.
export const buildOllamaPrompt = buildAssistantPrompt;

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function toInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getOllamaConfig(): OllamaProviderConfig {
  return {
    baseUrl: normalizeBaseUrl(
      process.env.ORDER_WITH_AI_OLLAMA_BASE_URL ||
      process.env.OLLAMA_BASE_URL ||
      DEFAULT_OLLAMA_BASE_URL,
    ),
    model:
      process.env.ORDER_WITH_AI_OLLAMA_MODEL ||
      process.env.OLLAMA_MODEL ||
      process.env.OLLAMA_GENERATE_MODEL ||
      DEFAULT_OLLAMA_MODEL,
    timeoutMs: toInt(
      process.env.AI_TIMEOUT_MS ||
      process.env.ORDER_WITH_AI_TIMEOUT_MS ||
      process.env.OLLAMA_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
    ),
  };
}

export function buildOllamaGenerateRequest(
  request: AiAssistantRequest,
  config: OllamaProviderConfig,
): OllamaGenerateRequest {
  return {
    model: config.model,
    system: HIREWAVE_ASSISTANT_SYSTEM_PROMPT,
    prompt: buildAssistantPrompt(request),
    stream: false,
  };
}

export async function generateOllamaAiResponse(input: {
  request: AiAssistantRequest;
  fetchImpl?: FetchLike;
  config?: OllamaProviderConfig;
}): Promise<AiProviderResult> {
  const config = input.config || getOllamaConfig();
  const fetchImpl = input.fetchImpl || fetch;
  const prompt = buildAssistantPrompt(input.request);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const url = `${normalizeBaseUrl(config.baseUrl)}/api/generate`;
  const requestBody = buildOllamaGenerateRequest(input.request, config);
  const files = includedFiles(input.request);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const rawBody = await response.text();
    let parsed: Record<string, unknown> = {};

    if (!response.ok) {
      throw new Error(`Ollama request failed (${response.status}): ${rawBody.slice(0, 500)}`);
    }

    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new Error(`Non-JSON Ollama response: ${rawBody.slice(0, 240)}`);
    }

    const content = typeof parsed.response === 'string' ? parsed.response.trim() : '';
    if (!content) throw new Error('Ollama response missing response text.');

    const model = typeof parsed.model === 'string' && parsed.model ? parsed.model : config.model;
    const latencyMs = Date.now() - startedAt;

    return {
      provider: 'ollama',
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
          providerPromptTokens: parsed.prompt_eval_count,
          providerCompletionTokens: parsed.eval_count,
        }),
      },
      safetyFlags: buildAssistantSafetyFlags(input.request),
      metadata: {
        configuredModel: config.model,
        baseUrl: config.baseUrl,
        done: parsed.done,
        doneReason: parsed.done_reason,
        totalDuration: parsed.total_duration,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}
