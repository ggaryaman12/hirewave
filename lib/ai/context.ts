import { parseJson } from '@/lib/json';
import type { getSessionByToken } from '@/lib/sessions';
import type { WorkspaceFile } from '@/lib/sandbox/simulated-provider';
import {
  AI_COLLABORATION_DIMENSIONS,
  type AiAssistantRequest,
  type AiCommandContext,
  type AiMessageContext,
} from '@/lib/ai/types';

type SessionForAiContext = NonNullable<Awaited<ReturnType<typeof getSessionByToken>>>;
type FileInput = WorkspaceFile & { version?: number };

const RECENT_COMMAND_LIMIT = 5;
const RECENT_AI_MESSAGE_LIMIT = 6;
const RECENT_FILE_EVENT_LIMIT = 12;
const MAX_COMMAND_SUMMARY_CHARS = 1200;
const MAX_AI_MESSAGE_CHARS = 900;

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n...[truncated]`;
}

function eventPayload(event: SessionForAiContext['events'][number]) {
  return parseJson<Record<string, unknown>>(event.payloadJson, {});
}

function stringPathFromPayload(payload: Record<string, unknown>) {
  return typeof payload.path === 'string' && payload.path.trim() ? payload.path : undefined;
}

function inferSelectedFilePath(session: SessionForAiContext, files: FileInput[]) {
  const reversedEvents = [...session.events].reverse();
  const openedPath = reversedEvents
    .filter((event) => ['file_opened', 'file_changed', 'file_saved'].includes(event.type))
    .map((event) => stringPathFromPayload(eventPayload(event)))
    .find(Boolean);

  return openedPath || files[0]?.path;
}

function recentEditedPaths(session: SessionForAiContext) {
  const edited = new Set<string>();
  for (const event of [...session.events].reverse().slice(0, RECENT_FILE_EVENT_LIMIT)) {
    if (!['file_changed', 'file_saved'].includes(event.type)) continue;
    const path = stringPathFromPayload(eventPayload(event));
    if (path) edited.add(path);
  }
  return edited;
}

function summarizeCommandOutput(output: string | null) {
  if (!output) return '(no output captured)';
  return truncate(output, MAX_COMMAND_SUMMARY_CHARS);
}

function buildRecentCommands(session: SessionForAiContext): AiCommandContext[] {
  return session.commandRuns.slice(-RECENT_COMMAND_LIMIT).map((run) => ({
    command: run.command,
    exitCode: run.exitCode,
    outputSummary: summarizeCommandOutput(run.output),
  }));
}

function buildRecentAiMessages(session: SessionForAiContext): AiMessageContext[] {
  return session.aiMessages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-RECENT_AI_MESSAGE_LIMIT)
    .map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: truncate(message.content, MAX_AI_MESSAGE_CHARS),
    }));
}

function inferLatestTestSummary(session: SessionForAiContext) {
  const run = [...session.commandRuns]
    .reverse()
    .find((candidate) => candidate.testResults.length > 0 || /\b(test|spec)\b/i.test(candidate.command));

  if (!run) return undefined;

  if (run.testResults.length > 0) {
    const passed = run.testResults.filter((result) => result.status === 'passed').length;
    return `Latest test run: ${passed}/${run.testResults.length} passed, exitCode=${run.exitCode ?? 'unknown'}`;
  }

  return summarizeCommandOutput(run.output);
}

export function buildAiAssistantRequest(input: {
  session: SessionForAiContext;
  candidateMessage: string;
  files: FileInput[];
}): AiAssistantRequest {
  const selectedFilePath = inferSelectedFilePath(input.session, input.files);
  const editedPaths = recentEditedPaths(input.session);
  const challenge = input.session.assessment.challenge;
  const instructions = [challenge.scenario, challenge.instructions].filter(Boolean).join('\n\n');

  return {
    sessionId: input.session.id,
    candidateMessage: input.candidateMessage,
    challenge: {
      title: challenge.title,
      role: input.session.assessment.role,
      instructions,
      rubricDimensions: [...AI_COLLABORATION_DIMENSIONS],
    },
    workspace: {
      selectedFilePath,
      files: input.files.map((file) => ({
        path: file.path,
        language: file.language,
        content: file.content,
        version: file.version,
        isSelected: file.path === selectedFilePath,
        isRecentlyEdited: editedPaths.has(file.path),
      })),
    },
    activity: {
      recentCommands: buildRecentCommands(input.session),
      recentAiMessages: buildRecentAiMessages(input.session),
      latestTestSummary: inferLatestTestSummary(input.session),
    },
    policy: {
      allowedHelp: 'guide_debugging_and_code_review',
      forbiddenHelp: [
        'Tell the candidate to run commands in the Terminal / tests panel.',
        'Supported MVP terminal commands: `npm test`, `ls`, `ls src`, `cat <path>`, `pwd`.',
        'Do not claim commands were run, tests passed, or files changed unless that evidence is present in the session context.',
        'Do not produce hiring recommendations, score the candidate, or reveal evaluator-only reasoning.',
        'Do not ask for secrets, external credentials, or production data.',
        'Do not suggest bypassing the assessment timer, telemetry, invite checks, or sandbox boundaries.',
      ],
    },
  };
}
