export const AI_COLLABORATION_DIMENSIONS = [
  'Problem Decomposition',
  'First-Principles Thinking',
  'Creative Problem Solving',
  'Iteration Quality',
  'Debugging with AI',
  'Architecture Decisions',
  'Communication Clarity',
  'Token Efficiency',
] as const;

export type AiProviderName = 'deterministic' | 'ollama' | 'openai-compatible';

export type AiFileContext = {
  path: string;
  language: string;
  content: string;
  version?: number;
  isSelected: boolean;
  isRecentlyEdited: boolean;
};

export type AiCommandContext = {
  command: string;
  exitCode: number | null;
  outputSummary: string;
};

export type AiMessageContext = {
  role: 'user' | 'assistant';
  content: string;
};

export type AiAssistantRequest = {
  sessionId: string;
  candidateMessage: string;
  challenge: {
    title: string;
    role: string;
    instructions: string;
    rubricDimensions: string[];
  };
  workspace: {
    selectedFilePath?: string;
    files: AiFileContext[];
  };
  activity: {
    recentCommands: AiCommandContext[];
    recentAiMessages: AiMessageContext[];
    latestTestSummary?: string;
  };
  policy: {
    allowedHelp: 'guide_debugging_and_code_review';
    forbiddenHelp: string[];
  };
};

export type AiProviderUsage = {
  promptChars: number;
  responseChars: number;
  includedFiles: string[];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tokenSource: 'provider' | 'estimated';
};

export type AiProviderResult = {
  provider: AiProviderName;
  model: string;
  content: string;
  latencyMs: number;
  usage?: AiProviderUsage;
  safetyFlags: string[];
  metadata: Record<string, unknown>;
};

// ---- Tool-calling (agent mode) ----

export type AiToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AiToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type AiChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: AiToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

export type AiToolChatResult = {
  content: string;
  toolCalls: AiToolCall[];
  finishReason?: string;
  reasoning?: string;
  model: string;
  usage: AiProviderUsage;
};
