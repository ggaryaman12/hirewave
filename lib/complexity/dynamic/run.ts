import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { instrumentJs } from '@/lib/complexity/dynamic/instrument-js';
import type { Telemetry } from '@/lib/complexity/types';

const DEFAULT_TIMEOUT_MS = 2000;

function emptyTelemetry(): Telemetry {
  return { ops: 0, hits: {}, steps: [], truncated: false, ok: false };
}

export function runInstrumented(code: string, stdin: string, timeoutMs = DEFAULT_TIMEOUT_MS): Telemetry {
  let instrumented: string;
  try { instrumented = instrumentJs(code); }
  catch { return emptyTelemetry(); }

  const dir = mkdtempSync(join(tmpdir(), 'cx-js-'));
  try {
    const file = join(dir, 'main.js');
    writeFileSync(file, instrumented, 'utf8');
    const res = spawnSync('node', [file], {
      input: stdin, cwd: dir, timeout: Math.max(500, timeoutMs),
      maxBuffer: 32 * 1024 * 1024, encoding: 'utf8',
    });
    const timedOut = Boolean(res.error && (res.error as NodeJS.ErrnoException).code === 'ETIMEDOUT');
    const line = (res.stdout || '').split('\n').reverse().find((l) => l.startsWith('__CX__'));
    if (!line) return { ...emptyTelemetry(), ok: false };
    const parsed = JSON.parse(line.slice(6)) as Omit<Telemetry, 'ok'>;
    const opCeiling = (res.stderr || '').includes('__CX_OP_CEILING__');
    return { ...parsed, ok: !timedOut && !opCeiling && res.status === 0 };
  } catch {
    return emptyTelemetry();
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
