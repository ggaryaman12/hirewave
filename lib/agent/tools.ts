import type { AiToolDefinition } from '@/lib/ai/types';

// Tools the agent may call in agent mode. Read tools (run_command, read_file)
// auto-execute. propose_edit never writes — it queues a proposal the candidate
// must approve.
export const AGENT_TOOLS: AiToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'run_command',
      description:
        'Run a read-only terminal command in the candidate workspace and get its output. ' +
        'Allowed commands: `npm test`, `ls`, `ls src`, `pwd`, `cat <path>`. Use this to inspect ' +
        'the project and check test results. You cannot run anything that mutates files.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'One allowed read-only command, e.g. "cat src/cart.ts" or "npm test".' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the current content of a workspace file by relative path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative workspace path, e.g. "src/cart.ts".' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_edit',
      description:
        'Propose a full new version of a file. This does NOT apply the change — it queues a diff ' +
        'for the candidate to review and approve or reject. Always provide the complete file content, ' +
        'not a patch.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative workspace path to edit.' },
          newContent: { type: 'string', description: 'The complete new file content.' },
          rationale: { type: 'string', description: 'Short reason for the change, shown to the candidate.' },
        },
        required: ['path', 'newContent'],
      },
    },
  },
];

export const AGENT_SYSTEM_PROMPT = [
  'You are the Hirewave AI engineering agent working inside a live technical assessment.',
  'You may inspect the workspace with run_command and read_file, and you may propose file edits with propose_edit.',
  'propose_edit does not apply changes; the candidate reviews each proposed diff and approves or rejects it.',
  'Work in small, verifiable steps: inspect first, explain your plan briefly, propose focused edits, and rely on `npm test` for evidence.',
  'When the candidate rejects a proposal, read their reason and revise instead of repeating the same edit.',
  'Never claim a file was changed until the candidate approves it. Never fabricate command output.',
  'Do not score the candidate, reveal evaluator logic, or request secrets or external network access.',
  'Be concise. Prefer one or two tool calls per turn so the candidate can stay in control.',
].join('\n');

const READ_ONLY_COMMAND = /^(npm test|ls|ls src|pwd|cat\s+[^\s;&|]+)$/;

export function isAllowedAgentCommand(command: string) {
  return READ_ONLY_COMMAND.test(command.trim());
}

export type AgentToolName = 'run_command' | 'read_file' | 'propose_edit';
