import type { SandboxResourceLimits } from './types';

const DEFAULT_COMMAND_TIMEOUT_MS = 10_000;
const DEFAULT_COMMAND_OUTPUT_LIMIT_CHARS = 20_000;
const DEFAULT_SNAPSHOT_CONTENT_LIMIT = 100_000;
const DEFAULT_SNAPSHOT_FILE_LIMIT = 200;

export function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function getSandboxResourceLimits(): SandboxResourceLimits {
  return {
    executionTimeoutMs: toPositiveInt(process.env.SANDBOX_COMMAND_TIMEOUT_MS, DEFAULT_COMMAND_TIMEOUT_MS),
    outputLimitChars: toPositiveInt(process.env.SANDBOX_COMMAND_OUTPUT_LIMIT, DEFAULT_COMMAND_OUTPUT_LIMIT_CHARS),
    snapshotFileLimit: toPositiveInt(process.env.SANDBOX_SNAPSHOT_FILE_LIMIT, DEFAULT_SNAPSHOT_FILE_LIMIT),
    snapshotContentLimit: toPositiveInt(process.env.SANDBOX_SNAPSHOT_CONTENT_LIMIT, DEFAULT_SNAPSHOT_CONTENT_LIMIT),
    memoryLimitMb: null,
    cpuLimitMs: null,
  };
}
