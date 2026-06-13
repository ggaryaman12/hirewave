const KNOWN_ASSESSMENT_TERMS = [
  'api',
  'assistant',
  'auth',
  'bug',
  'cart',
  'checkout',
  'code',
  'command',
  'continue',
  'csv',
  'custom',
  'debug',
  'error',
  'evidence',
  'explain',
  'fail',
  'file',
  'fix',
  'guardrail',
  'help',
  'idempotency',
  'import',
  'inspect',
  'inventory',
  'issue',
  'more',
  'next',
  'no',
  'npm',
  'payment',
  'permission',
  'quantity',
  'README',
  'review',
  'rollback',
  'run',
  'show',
  'src',
  'start',
  'terminal',
  'test',
  'transaction',
  'typescript',
  'validate',
  'webhook',
  'workspace',
  'what',
  'where',
  'why',
  'yes',
].map((term) => term.toLowerCase());

export const INPUT_CLARIFIER_MODEL = 'input-clarifier-v1';
export const CAPABILITY_CLARIFIER_MODEL = 'capability-clarifier-v1';

export const LOW_SIGNAL_AI_CONTENT = [
  'I could not understand that message well enough to give useful help.',
  '',
  'Ask a specific question about the challenge, a file, a failing test, terminal output, or the behavior you want to debug.',
  '',
  'Useful examples:',
  '- Where should I start?',
  '- Why is this test failing?',
  '- Review src/solution-plan.ts for missing evidence.',
].join('\n');

export const CAPABILITY_BOUNDARY_AI_CONTENT = [
  'I cannot run commands directly or edit files for you.',
  '',
  'Use the Terminal / tests panel to run commands yourself, then ask me about the output. I can help you interpret failures, choose what to inspect next, and review your changes.',
  '',
  'Useful commands:',
  '- `ls src`',
  '- `cat README.md`',
  '- `cat src/solution-plan.ts`',
  '- `npm test`',
].join('\n');

function hasKnownSignal(lower: string) {
  return KNOWN_ASSESSMENT_TERMS.some((term) => lower.includes(term));
}

function hasPathOrCommandSignal(value: string) {
  return /(?:^|\s)(?:ls|cat|npm|pnpm|yarn|node|grep|rg)(?:\s|$)/i.test(value) ||
    /(?:src|tests?)\/[a-z0-9_.\-/]+/i.test(value) ||
    /\b[a-z0-9_-]+\.(?:ts|tsx|js|jsx|json|md)\b/i.test(value);
}

function tokenizedWords(value: string) {
  return value
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
}

function vowelRatio(word: string) {
  const letters = word.match(/[a-z]/g) || [];
  if (!letters.length) return 1;
  const vowels = letters.filter((letter) => /[aeiou]/.test(letter));
  return vowels.length / letters.length;
}

export function getLowSignalPromptReason(message: string) {
  const trimmed = message.trim();
  if (!trimmed) return 'empty_prompt';

  const lower = trimmed.toLowerCase();
  const words = tokenizedWords(trimmed);
  if (!words.length) return 'non_text_prompt';
  if (hasKnownSignal(lower) || hasPathOrCommandSignal(trimmed)) return null;

  if (trimmed.length <= 2) return 'too_short_prompt';

  if (words.length === 1) {
    const [word] = words;
    if (word.length <= 4) return 'unknown_short_token';
    if (word.length >= 8) return 'unknown_single_token';
    if (word.length >= 5 && vowelRatio(word) < 0.22) return 'low_vowel_single_token';
  }

  if (words.length <= 3 && words.every((word) => word.length >= 4)) {
    const averageVowelRatio = words.reduce((sum, word) => sum + vowelRatio(word), 0) / words.length;
    if (averageVowelRatio < 0.25) return 'low_signal_short_prompt';
  }

  return null;
}

export function getCapabilityBoundaryReason(message: string) {
  const lower = message.trim().toLowerCase();
  if (!lower) return null;

  const asksAssistantToRun =
    /\b(can|could|will|would|please|pls)\s+you\b[\s\S]*\b(run|execute|start)\b[\s\S]*\b(test|tests|npm|command|terminal|shell)\b/.test(lower) ||
    /\brun\b[\s\S]*\b(test|tests|npm|command|terminal|shell)\b[\s\S]*\b(for me|yourself)\b/.test(lower) ||
    /\bhelp me\s+run(?:\s+(?:test|tests|npm|command|terminal|shell))?\b/.test(lower);

  if (asksAssistantToRun) return 'assistant_cannot_run_commands';

  const asksAssistantToEdit =
    /\b(can|could|will|would|please|pls)\s+you\b[\s\S]*\b(edit|change|changes|modify|fix|implement|make)\b[\s\S]*\b(file|files|code|src\/|checkout|cart|payment)\b/.test(lower) ||
    /\b(can|could|will|would|please|pls)\s+you\b[\s\S]*\bimplement\b[\s\S]*\b(for me|this|it)\b/.test(lower) ||
    /\b(make|apply)\b[\s\S]*\b(changes|edits|fixes)\b[\s\S]*\b(for me|to my code|in my code|to the code)\b/.test(lower);

  if (asksAssistantToEdit) return 'assistant_cannot_edit_files';

  return null;
}
