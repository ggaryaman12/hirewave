import { validateWorkspacePath } from '@/lib/workspace-paths';

type ChallengeFileLike = {
  path: string;
  language: string;
  content: string;
};

export type ChallengeValidationIssue = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  path?: string;
};

export type ChallengeValidationResult = {
  status: 'blocked' | 'review_ready';
  issueCount: number;
  errorCount: number;
  warningCount: number;
  allowedCommands: string[];
  evidenceChecklist: string[];
  issues: ChallengeValidationIssue[];
};

const MAX_FILE_COUNT = 60;
const MAX_FILE_BYTES = 40_000;

function hasFile(files: ChallengeFileLike[], path: string) {
  return files.some((file) => file.path === path);
}

function hasAnyFile(files: ChallengeFileLike[], paths: string[]) {
  return paths.some((path) => hasFile(files, path));
}

function looksLikeSecret(content: string) {
  return /(api[_-]?key|secret|password|credential|access[_-]?token)\s*[:=]\s*['"`][a-z0-9_\-./+=]{8,}['"`]/i.test(content);
}

function allowedCommandsForFiles(files: ChallengeFileLike[]) {
  const commands = new Set<string>(['ls', 'pwd']);
  if (files.some((file) => file.path.startsWith('tests/') || /\.test\.[tj]sx?$/.test(file.path))) {
    commands.add('npm test');
  }

  for (const file of files) {
    if (!file.path.endsWith('package.json')) continue;
    try {
      const parsed = JSON.parse(file.content) as { scripts?: Record<string, unknown> };
      if (parsed.scripts && typeof parsed.scripts.test === 'string') commands.add('npm test');
      if (parsed.scripts && typeof parsed.scripts.verify === 'string') commands.add('npm run verify');
      if (parsed.scripts && typeof parsed.scripts.build === 'string') commands.add('npm run build');
      commands.add('npm install');
    } catch {
      commands.add('npm test');
    }
  }

  return Array.from(commands);
}

function pushIssue(issues: ChallengeValidationIssue[], issue: ChallengeValidationIssue) {
  issues.push(issue);
}

export function validateChallengeDraftFiles(files: ChallengeFileLike[]): ChallengeValidationResult {
  const issues: ChallengeValidationIssue[] = [];
  const paths = files.map((file) => file.path);
  const duplicatePaths = paths.filter((path, index) => paths.indexOf(path) !== index);

  if (files.length < 3) {
    pushIssue(issues, {
      severity: 'error',
      code: 'too_few_files',
      message: 'Draft needs at least a brief, implementation file, and test or verification file.',
    });
  }

  if (files.length > MAX_FILE_COUNT) {
    pushIssue(issues, {
      severity: 'error',
      code: 'too_many_files',
      message: `Draft has ${files.length} files; keep candidate workspaces under ${MAX_FILE_COUNT} files for v1.`,
    });
  }

  for (const duplicatePath of Array.from(new Set(duplicatePaths))) {
    pushIssue(issues, {
      severity: 'error',
      code: 'duplicate_path',
      path: duplicatePath,
      message: 'Draft file paths must be unique.',
    });
  }

  for (const file of files) {
    const workspacePath = validateWorkspacePath(file.path);
    if (!workspacePath.ok) {
      pushIssue(issues, {
        severity: 'error',
        code: 'unsafe_path',
        path: file.path,
        message: `Unsafe workspace path: ${workspacePath.reason}.`,
      });
    }

    if (file.content.length > MAX_FILE_BYTES) {
      pushIssue(issues, {
        severity: 'warning',
        code: 'large_file',
        path: file.path,
        message: `File is ${file.content.length} characters; keep starter files focused for timed assessments.`,
      });
    }

    if (looksLikeSecret(file.content)) {
      pushIssue(issues, {
        severity: 'error',
        code: 'possible_secret',
        path: file.path,
        message: 'Starter files must not contain hard-coded secrets, credentials, or access tokens.',
      });
    }
  }

  if (!hasAnyFile(files, ['README.md', 'BRIEF.md'])) {
    pushIssue(issues, {
      severity: 'error',
      code: 'missing_candidate_brief',
      message: 'Draft needs README.md or BRIEF.md so candidates understand the task without interviewer context.',
    });
  }

  if (!files.some((file) => file.path.startsWith('tests/') || /\.test\.[tj]sx?$/.test(file.path))) {
    pushIssue(issues, {
      severity: 'error',
      code: 'missing_tests',
      message: 'Draft needs at least one public test or verification file.',
    });
  }

  if (!hasFile(files, 'src/solution-plan.ts')) {
    pushIssue(issues, {
      severity: 'warning',
      code: 'missing_solution_plan',
      message: 'A src/solution-plan.ts file gives reports a consistent place to cite root cause, risk controls, and verification evidence.',
    });
  }

  if (files.some((file) => /TODO/i.test(file.content))) {
    pushIssue(issues, {
      severity: 'warning',
      code: 'starter_todos',
      message: 'Starter TODOs are allowed in drafts, but reviewer approval should confirm they guide rather than solve the task.',
    });
  }

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.length - errorCount;

  return {
    status: errorCount > 0 ? 'blocked' : 'review_ready',
    issueCount: issues.length,
    errorCount,
    warningCount,
    allowedCommands: allowedCommandsForFiles(files),
    evidenceChecklist: [
      'Candidate-facing brief exists.',
      'Starter files stay inside the workspace boundary.',
      'Public verification file exists.',
      'No hard-coded secrets detected.',
      'Report can cite root cause, risk controls, verification evidence, AI prompts, commands, and final diffs.',
    ],
    issues,
  };
}
