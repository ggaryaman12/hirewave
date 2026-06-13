import type { AiAssistantRequest, AiFileContext, AiProviderResult } from '@/lib/ai/types';
import { buildTokenUsage } from '@/lib/ai/token-usage';

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
const MAX_FILE_CHARS = 2500;
const MAX_CONTEXT_CHARS = 12000;
const MAX_COMMAND_CHARS = 1200;
const MAX_AI_MESSAGE_CHARS = 900;

export const HIREWAVE_OLLAMA_SYSTEM_PROMPT = [
  'You are the Hirewave AI coding assistant inside a technical assessment.',
  'Help the candidate reason through realistic engineering work using the files and test evidence provided.',
  'Use the fixed Hirewave AI collaboration rubric only as coaching context; never score the candidate or reveal evaluator logic.',
  'Be concise and practical. Suggest inspection steps, debugging strategy, terminal commands to run, and code-level fixes when useful.',
  'The candidate has an MVP terminal. Prefer supported commands from policy, such as npm test, ls src, cat <path>, and pwd.',
  'If the candidate request is unclear, nonsensical, or too low-signal, ask for a clearer question instead of inferring progress or inventing facts.',
  'Do not claim you ran commands or changed files. The candidate must verify all output with the runner.',
  'Do not produce hiring recommendations or evaluation scores for the candidate.',
].join('\n');

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function toInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n...[truncated]`;
}

function includedFiles(request: AiAssistantRequest) {
  const selectedPath = request.workspace.selectedFilePath;
  const selected = request.workspace.files.filter((file) => file.path === selectedPath || file.isSelected);
  const recentlyEdited = request.workspace.files.filter((file) => file.isRecentlyEdited);
  const fallback = request.workspace.files.slice(0, 2);
  const files = [...selected, ...recentlyEdited, ...fallback];
  const unique = new Map<string, AiFileContext>();

  for (const file of files) {
    unique.set(file.path, file);
  }

  return Array.from(unique.values()).slice(0, 4);
}

function fileHeader(file: AiFileContext) {
  const tags = [
    file.isSelected ? 'selected' : undefined,
    file.isRecentlyEdited ? 'recently edited' : undefined,
    file.version ? `version ${file.version}` : undefined,
  ].filter(Boolean).join(', ');

  return `--- ${file.path}${tags ? `\n[${tags}]` : ''}`;
}

function commandEvidence(request: AiAssistantRequest) {
  if (!request.activity.recentCommands.length) return '(no recent command evidence)';

  return request.activity.recentCommands
    .slice(-3)
    .map((command) => [
      `$ ${command.command}`,
      `exitCode: ${command.exitCode ?? 'unknown'}`,
      truncate(command.outputSummary, MAX_COMMAND_CHARS),
    ].join('\n'))
    .join('\n\n');
}

function recentAiContext(request: AiAssistantRequest) {
  if (!request.activity.recentAiMessages.length) return '(no recent AI context)';

  return request.activity.recentAiMessages
    .slice(-4)
    .map((message) => `${message.role}: ${truncate(message.content, MAX_AI_MESSAGE_CHARS)}`)
    .join('\n');
}

function policyText(request: AiAssistantRequest) {
  return [
    `Allowed help: ${request.policy.allowedHelp}`,
    ...request.policy.forbiddenHelp.map((rule) => `- ${rule}`),
  ].join('\n');
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

export function buildOllamaPrompt(request: AiAssistantRequest) {
  const files = includedFiles(request);
  const fileContext = files
    .map((file) => `${fileHeader(file)}\n${truncate(file.content, MAX_FILE_CHARS)}`)
    .join('\n\n');

  return truncate([
    'You are helping with a live Hirewave engineering assessment.',
    `Candidate request: ${JSON.stringify(request.candidateMessage)}`,
    '',
    `Challenge: ${request.challenge.title}`,
    `Role: ${request.challenge.role}`,
    '',
    'Challenge instructions:',
    truncate(request.challenge.instructions, 1800),
    '',
    'AI collaboration rubric focus:',
    ...request.challenge.rubricDimensions.map((dimension) => `- ${dimension}`),
    '',
    'Recent command evidence:',
    commandEvidence(request),
    '',
    'Recent AI context:',
    recentAiContext(request),
    '',
    'Latest test summary:',
    request.activity.latestTestSummary || '(no latest test summary)',
    '',
    'Workspace context:',
    fileContext || '(no files available)',
    '',
    'Policy:',
    policyText(request),
    '',
    'Answer for the candidate. Guide their debugging and implementation work without scoring them or exposing evaluator-only criteria.',
  ].join('\n'), MAX_CONTEXT_CHARS);
}

export function buildOllamaGenerateRequest(
  request: AiAssistantRequest,
  config: OllamaProviderConfig,
): OllamaGenerateRequest {
  return {
    model: config.model,
    system: HIREWAVE_OLLAMA_SYSTEM_PROMPT,
    prompt: buildOllamaPrompt(request),
    stream: false,
  };
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

export async function generateOllamaAiResponse(input: {
  request: AiAssistantRequest;
  fetchImpl?: FetchLike;
  config?: OllamaProviderConfig;
}): Promise<AiProviderResult> {
  const config = input.config || getOllamaConfig();
  const fetchImpl = input.fetchImpl || fetch;
  const prompt = buildOllamaPrompt(input.request);
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
      safetyFlags: buildSafetyFlags(input.request),
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
