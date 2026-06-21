// Central domain constants — the single source of truth for the status / role /
// enum string literals used across the app. These are PURE strings with no
// server-only imports, so this module is import-safe in BOTH client and server
// bundles. One place, no duplication: change a value here, not in 1000 call
// sites. Prisma columns stay `String` (Prisma can't import TS), but every app
// read/write should go through these constants so the values can't drift.
//
// Pattern per domain: an `as const` object (use X.VALUE instead of a literal),
// a derived union type (same name), and—where useful—a values array for zod
// enums and iteration.

export const UserRole = {
  STUDENT: 'student',
  RECRUITER: 'recruiter',
  ADMIN: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const WorkspaceRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;
export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

export const Language = {
  CPP: 'cpp',
  JAVA: 'java',
  JAVASCRIPT: 'javascript',
} as const;
export type Language = (typeof Language)[keyof typeof Language];
export const LANGUAGES = [Language.CPP, Language.JAVA, Language.JAVASCRIPT] as const;

export const Verdict = {
  ACCEPTED: 'accepted',
  WRONG_ANSWER: 'wrong_answer',
  TLE: 'tle',
  MLE: 'mle',
  RUNTIME_ERROR: 'runtime_error',
  COMPILE_ERROR: 'compile_error',
  ERROR: 'error',
  JUDGING: 'judging',
} as const;
export type Verdict = (typeof Verdict)[keyof typeof Verdict];

export const JudgeRunStatus = {
  OK: 'ok',
  TLE: 'tle',
  MLE: 'mle',
  RUNTIME_ERROR: 'runtime_error',
  COMPILE_ERROR: 'compile_error',
  ERROR: 'error',
} as const;
export type JudgeRunStatus = (typeof JudgeRunStatus)[keyof typeof JudgeRunStatus];

export const ComparisonPolicy = {
  EXACT: 'exact',
  WHITESPACE: 'whitespace',
  FLOAT: 'float',
} as const;
export type ComparisonPolicy = (typeof ComparisonPolicy)[keyof typeof ComparisonPolicy];

// DSA submission lifecycle (running -> done | error). See lib/judge/submit.ts.
export const SubmissionStatus = {
  RUNNING: 'running',
  DONE: 'done',
  ERROR: 'error',
} as const;
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

export const ProgressStatus = {
  ATTEMPTED: 'attempted',
  SOLVED: 'solved',
} as const;
export type ProgressStatus = (typeof ProgressStatus)[keyof typeof ProgressStatus];

export const ProblemStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;
export type ProblemStatus = (typeof ProblemStatus)[keyof typeof ProblemStatus];

export const ProblemKind = {
  FUNCTION: 'function',
  STDIN: 'stdin',
  DESIGN: 'design',
} as const;
export type ProblemKind = (typeof ProblemKind)[keyof typeof ProblemKind];

export const Difficulty = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
} as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

// Hiring candidate session lifecycle.
export const CandidateSessionStatus = {
  CREATED: 'created',
  STARTED: 'started',
  SUBMITTED: 'submitted',
  EXPIRED: 'expired',
  REPORT_READY: 'report_ready',
} as const;
export type CandidateSessionStatus = (typeof CandidateSessionStatus)[keyof typeof CandidateSessionStatus];

export const AiMessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;
export type AiMessageRole = (typeof AiMessageRole)[keyof typeof AiMessageRole];
