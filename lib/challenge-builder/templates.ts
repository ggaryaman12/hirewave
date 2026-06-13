export const CUSTOM_DRAFT_PREFIX = 'Draft - ';
export const CUSTOM_APPROVED_PREFIX = 'Custom - ';

export const CUSTOM_TASK_TYPES = [
  'Bug fix',
  'Feature extension',
  'Refactor',
  'Reliability incident',
  'Guardrail hardening',
];

export const CUSTOM_TASK_DOMAINS = [
  'Payments',
  'SaaS authorization',
  'Commerce',
  'Data import',
  'AI assessment policy',
  'Realtime',
];

export const CUSTOM_FOCUS_SKILLS = [
  'Debugging',
  'API design',
  'Database reasoning',
  'Communication clarity',
  'System design',
  'Security boundary',
  'Testing',
  'Observability',
];

export function isCustomChallengeSlug(slug: string) {
  return slug.startsWith('custom-');
}

export function isDraftDifficulty(difficulty: string) {
  return difficulty.startsWith(CUSTOM_DRAFT_PREFIX);
}

export function isApprovedCustomDifficulty(difficulty: string) {
  return difficulty.startsWith(CUSTOM_APPROVED_PREFIX);
}

export function extractDraftSeniority(difficulty: string) {
  if (isDraftDifficulty(difficulty)) return difficulty.slice(CUSTOM_DRAFT_PREFIX.length).trim();
  if (isApprovedCustomDifficulty(difficulty)) return difficulty.slice(CUSTOM_APPROVED_PREFIX.length).trim();
  return difficulty;
}

export function approvedCustomDifficulty(difficulty: string) {
  return `${CUSTOM_APPROVED_PREFIX}${extractDraftSeniority(difficulty) || 'Custom'}`;
}
