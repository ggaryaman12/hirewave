import type { JudgeProvider, JudgeRunInput, JudgeRunResult, JudgeRunStatus } from '@/lib/judge/types';

// Judge0 client (works with self-hosted Judge0 or the public CE at
// https://ce.judge0.com). Judge0 wraps `isolate` for deterministic CPU/wall/
// memory limits — the correctness-first execution engine for the judge.
//
// Hardened for the shared public CE: base64 I/O (avoids stdin/stdout corruption
// on non-ASCII or whitespace edge cases), retry with exponential backoff on
// HTTP 429/5xx + transient network errors, and a create+poll fallback when a
// `wait=true` response comes back still queued/processing.
//
// Env: JUDGE0_URL (required), JUDGE0_TOKEN (optional X-Auth-Token),
//      JUDGE0_MAX_ATTEMPTS (default 4), JUDGE0_POLL_ATTEMPTS (default 10).

const LANGUAGE_IDS: Record<string, number> = {
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
  if (statusId === 4) return 'ok'; // Wrong Answer at Judge0 level — we compare ourselves
  if (statusId === 5) return 'tle';
  if (statusId === 6) return 'compile_error';
  if (statusId >= 7 && statusId <= 12) return 'runtime_error';
  if (statusId === 13) return 'error';
  if (statusId === 14) return 'error';
  return 'error';
}

const b64encode = (value: string) => Buffer.from(value, 'utf8').toString('base64');
const b64decode = (value: unknown) =>
  typeof value === 'string' && value.length ? Buffer.from(value, 'base64').toString('utf8') : '';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Judge0Provider implements JudgeProvider {
  id = 'judge0';
  private baseUrl: string;
  private token?: string;
  private fetchImpl: typeof fetch;
  private maxAttempts: number;
  private pollAttempts: number;

  constructor(options?: { baseUrl?: string; token?: string; fetchImpl?: typeof fetch; maxAttempts?: number; pollAttempts?: number }) {
    this.baseUrl = (options?.baseUrl || process.env.JUDGE0_URL || '').replace(/\/+$/, '');
    this.token = options?.token || process.env.JUDGE0_TOKEN;
    this.fetchImpl = options?.fetchImpl || fetch;
    this.maxAttempts = options?.maxAttempts ?? Number(process.env.JUDGE0_MAX_ATTEMPTS || 4);
    this.pollAttempts = options?.pollAttempts ?? Number(process.env.JUDGE0_POLL_ATTEMPTS || 10);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['X-Auth-Token'] = this.token;
    return headers;
  }

  // Fetch with retry/backoff on 429 + 5xx + network errors.
  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError = '';
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      if (attempt > 0) await sleep(Math.min(2000, 250 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 150));
      try {
        const response = await this.fetchImpl(url, init);
        if (response.status === 429 || response.status >= 500) {
          lastError = `Judge0 HTTP ${response.status}`;
          continue; // retry
        }
        return response;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    throw new Error(lastError || 'Judge0 request failed');
  }

  private toResult(result: Record<string, unknown>): JudgeRunResult {
    const status = (result.status || {}) as { id?: number };
    const runtimeMs = Math.round(Number(result.time || 0) * 1000);
    const memoryKb = Number.isFinite(Number(result.memory)) ? Number(result.memory) : null;
    return {
      status: mapStatus(Number(status.id ?? 13)),
      stdout: b64decode(result.stdout),
      stderr: [b64decode(result.stderr), b64decode(result.compile_output)].filter(Boolean).join('\n'),
      exitCode: typeof result.exit_code === 'number' ? result.exit_code : null,
      signal: typeof result.exit_signal === 'number' ? String(result.exit_signal) : null,
      runtimeMs,
      memoryKb,
    };
  }

  async run(input: JudgeRunInput): Promise<JudgeRunResult> {
    if (!this.baseUrl) {
      return { status: 'error', stdout: '', stderr: 'JUDGE0_URL not configured', exitCode: null, signal: null, runtimeMs: 0, memoryKb: null };
    }

    const languageId = LANGUAGE_IDS[input.language.toLowerCase()];
    if (!languageId) {
      return { status: 'error', stdout: '', stderr: `Unsupported language: ${input.language}`, exitCode: null, signal: null, runtimeMs: 0, memoryKb: null };
    }

    const body = {
      language_id: languageId,
      source_code: b64encode(input.source),
      stdin: b64encode(input.stdin),
      cpu_time_limit: Math.max(1, Math.ceil(input.timeLimitMs / 1000)),
      wall_time_limit: Math.max(2, Math.ceil((input.timeLimitMs / 1000) * 2)),
      memory_limit: input.memoryLimitMb * 1024, // KB
    };

    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/submissions?base64_encoded=true&wait=true`,
        { method: 'POST', headers: this.headers(), body: JSON.stringify(body) },
      );

      if (!response.ok) {
        const text = await response.text();
        return { status: 'error', stdout: '', stderr: `Judge0 ${response.status}: ${text.slice(0, 300)}`, exitCode: null, signal: null, runtimeMs: 0, memoryKb: null };
      }

      let result = (await response.json()) as Record<string, unknown>;
      const statusId = Number((result.status as { id?: number })?.id ?? 0);

      // Some CE deployments ignore wait=true and return a queued token. Poll it.
      if ((statusId === 1 || statusId === 2) && typeof result.token === 'string') {
        result = await this.poll(result.token);
      }

      return this.toResult(result);
    } catch (err) {
      return { status: 'error', stdout: '', stderr: `Judge0 unreachable: ${err instanceof Error ? err.message : String(err)}`, exitCode: null, signal: null, runtimeMs: 0, memoryKb: null };
    }
  }

  private async poll(token: string): Promise<Record<string, unknown>> {
    let result: Record<string, unknown> = {};
    for (let attempt = 0; attempt < this.pollAttempts; attempt += 1) {
      await sleep(Math.min(1500, 300 + attempt * 200));
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/submissions/${token}?base64_encoded=true&fields=stdout,stderr,compile_output,status,time,memory,exit_code,exit_signal`,
        { method: 'GET', headers: this.headers() },
      );
      if (!response.ok) continue;
      result = (await response.json()) as Record<string, unknown>;
      const statusId = Number((result.status as { id?: number })?.id ?? 0);
      if (statusId >= 3) return result; // finished
    }
    return result;
  }
}
