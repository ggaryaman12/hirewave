import type { JudgeProvider, JudgeRunInput, JudgeRunResult, JudgeRunStatus } from '@/lib/judge/types';

// Self-hosted Judge0 client. Judge0 wraps `isolate` for deterministic CPU/wall/
// memory limits — the correctness-first execution engine for the judge.
// Configure JUDGE0_URL (e.g. http://judge0:2358) and optional JUDGE0_TOKEN.

const LANGUAGE_IDS: Record<string, number> = {
  // Judge0 CE language ids (stable set).
  c: 50,
  cpp: 54,
  'c++': 54,
  java: 62,
  javascript: 63,
  node: 63,
  python: 71,
  python3: 71,
  go: 60,
  ruby: 72,
  rust: 73,
  csharp: 51,
  kotlin: 78,
  typescript: 74,
};

// Judge0 status ids -> our run status.
function mapStatus(statusId: number): JudgeRunStatus {
  if (statusId === 3) return 'ok'; // Accepted (execution finished)
  if (statusId === 4) return 'ok'; // Wrong Answer at Judge0 level — we compare ourselves, so treat as ok output
  if (statusId === 5) return 'tle'; // Time Limit Exceeded
  if (statusId === 6) return 'compile_error';
  if (statusId >= 7 && statusId <= 12) return 'runtime_error'; // runtime errors (SIGSEGV, etc.)
  if (statusId === 13) return 'error'; // internal error
  if (statusId === 14) return 'error'; // exec format error
  return 'error';
}

export class Judge0Provider implements JudgeProvider {
  id = 'judge0';
  private baseUrl: string;
  private token?: string;
  private fetchImpl: typeof fetch;

  constructor(options?: { baseUrl?: string; token?: string; fetchImpl?: typeof fetch }) {
    this.baseUrl = (options?.baseUrl || process.env.JUDGE0_URL || '').replace(/\/+$/, '');
    this.token = options?.token || process.env.JUDGE0_TOKEN;
    this.fetchImpl = options?.fetchImpl || fetch;
  }

  async run(input: JudgeRunInput): Promise<JudgeRunResult> {
    if (!this.baseUrl) {
      return { status: 'error', stdout: '', stderr: 'JUDGE0_URL not configured', exitCode: null, signal: null, runtimeMs: 0, memoryKb: null };
    }

    const languageId = LANGUAGE_IDS[input.language.toLowerCase()];
    if (!languageId) {
      return { status: 'error', stdout: '', stderr: `Unsupported language: ${input.language}`, exitCode: null, signal: null, runtimeMs: 0, memoryKb: null };
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['X-Auth-Token'] = this.token;

    const body = {
      language_id: languageId,
      source_code: input.source,
      stdin: input.stdin,
      cpu_time_limit: Math.max(1, Math.ceil(input.timeLimitMs / 1000)),
      wall_time_limit: Math.max(2, Math.ceil((input.timeLimitMs / 1000) * 2)),
      memory_limit: input.memoryLimitMb * 1024, // Judge0 memory_limit is in KB
    };

    // wait=true returns the result synchronously; base64 off for simplicity.
    const response = await this.fetchImpl(`${this.baseUrl}/submissions?base64_encoded=false&wait=true`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return { status: 'error', stdout: '', stderr: `Judge0 ${response.status}: ${text.slice(0, 300)}`, exitCode: null, signal: null, runtimeMs: 0, memoryKb: null };
    }

    const result = (await response.json()) as Record<string, unknown>;
    const status = (result.status || {}) as { id?: number };
    const runtimeMs = Math.round(Number(result.time || 0) * 1000);
    const memoryKb = Number.isFinite(Number(result.memory)) ? Number(result.memory) : null;

    return {
      status: mapStatus(Number(status.id ?? 13)),
      stdout: typeof result.stdout === 'string' ? result.stdout : '',
      stderr: [result.stderr, result.compile_output].filter((value) => typeof value === 'string' && value).join('\n'),
      exitCode: typeof result.exit_code === 'number' ? result.exit_code : null,
      signal: typeof result.exit_signal === 'number' ? String(result.exit_signal) : null,
      runtimeMs,
      memoryKb,
    };
  }
}
