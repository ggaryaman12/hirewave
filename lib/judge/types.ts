export type JudgeRunStatus =
  | 'ok'
  | 'tle'
  | 'mle'
  | 'runtime_error'
  | 'compile_error'
  | 'error';

export type JudgeRunInput = {
  language: string;
  source: string;
  stdin: string;
  timeLimitMs: number;
  memoryLimitMb: number;
};

export type JudgeRunResult = {
  status: JudgeRunStatus;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  runtimeMs: number;
  memoryKb: number | null;
};

export type JudgeRunFn = (input: JudgeRunInput) => Promise<JudgeRunResult>;

export interface JudgeProvider {
  id: string;
  run(input: JudgeRunInput): Promise<JudgeRunResult>;
}

export type ComparisonPolicy = 'exact' | 'whitespace' | 'float';

export type Verdict =
  | 'accepted'
  | 'wrong_answer'
  | 'tle'
  | 'mle'
  | 'runtime_error'
  | 'compile_error'
  | 'error'
  | 'judging';

export type TestCaseResult = {
  index: number;
  status: Verdict;
  runtimeMs: number;
  memoryKb: number | null;
};

export type GradeResult = {
  verdict: Verdict;
  passedCount: number;
  totalCount: number;
  runtimeMs: number;
  memoryKb: number | null;
  failingCase: number | null;
  message: string | null;
  results: TestCaseResult[];
};
