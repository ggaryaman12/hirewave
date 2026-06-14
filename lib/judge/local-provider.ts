import { spawnSync } from 'child_process';
import type { JudgeProvider, JudgeRunInput, JudgeRunResult } from '@/lib/judge/types';

// Deterministic in-process provider for tests/dev ONLY. Not real isolation — do
// not use for production judging (use Judge0). Supports:
//   - 'echo': stdout = stdin (deterministic; used by the test suite)
//   - 'node': runs `node -e <source>` with stdin piped, behind JUDGE_LOCAL_NODE
//     (local dev convenience only, no sandbox)
export class LocalJudgeProvider implements JudgeProvider {
  id = 'local';

  async run(input: JudgeRunInput): Promise<JudgeRunResult> {
    const startedAt = Date.now();

    if (input.language === 'echo') {
      return {
        status: 'ok',
        stdout: input.stdin,
        stderr: '',
        exitCode: 0,
        signal: null,
        runtimeMs: Date.now() - startedAt,
        memoryKb: null,
      };
    }

    if (input.language === 'node' && process.env.JUDGE_LOCAL_NODE === 'true') {
      const result = spawnSync('node', ['-e', input.source], {
        input: input.stdin,
        timeout: input.timeLimitMs,
        maxBuffer: 10 * 1024 * 1024,
        encoding: 'utf8',
      });
      const timedOut = result.error && 'code' in result.error && (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT';
      return {
        status: timedOut ? 'tle' : result.status === 0 ? 'ok' : 'runtime_error',
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.status,
        signal: result.signal || null,
        runtimeMs: Date.now() - startedAt,
        memoryKb: null,
      };
    }

    return {
      status: 'error',
      stdout: '',
      stderr: `Local judge does not support language "${input.language}". Use Judge0 in production.`,
      exitCode: null,
      signal: null,
      runtimeMs: Date.now() - startedAt,
      memoryKb: null,
    };
  }
}
