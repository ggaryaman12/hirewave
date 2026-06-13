import type { AiAssistantRequest, AiFileContext } from '@/lib/ai/types';

export const MAX_FILE_CHARS = 2500;
export const MAX_CONTEXT_CHARS = 12000;
export const MAX_COMMAND_CHARS = 1200;
export const MAX_AI_MESSAGE_CHARS = 900;

// Shared coaching system prompt for every hosted assistant provider (Ollama,
// NVIDIA / OpenAI-compatible, and any future endpoint). The assistant stays
// coaching-only: it never runs commands, edits files, or scores the candidate.
export const HIREWAVE_ASSISTANT_SYSTEM_PROMPT = [
  'You are the Hirewave AI coding assistant inside a technical assessment.',
  'Help the candidate reason through realistic engineering work using the files and test evidence provided.',
  'Use the fixed Hirewave AI collaboration rubric only as coaching context; never score the candidate or reveal evaluator logic.',
  'Be concise and practical. Suggest inspection steps, debugging strategy, terminal commands to run, and code-level fixes when useful.',
  'The candidate has an MVP terminal. Prefer supported commands from policy, such as npm test, ls src, cat <path>, and pwd.',
  'If the candidate request is unclear, nonsensical, or too low-signal, ask for a clearer question instead of inferring progress or inventing facts.',
  'Do not claim you ran commands or changed files. The candidate must verify all output with the runner.',
  'Do not produce hiring recommendations or evaluation scores for the candidate.',
].join('\n');

export function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n...[truncated]`;
}

export function includedFiles(request: AiAssistantRequest) {
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

// Builds the candidate-facing assessment prompt body shared by every hosted
// provider. Provider adapters wrap this with their own transport payload.
export function buildAssistantPrompt(request: AiAssistantRequest) {
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

// Shared candidate-message safety flags. Same heuristics every provider records.
export function buildAssistantSafetyFlags(request: AiAssistantRequest) {
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
