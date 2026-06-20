import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { JudgeProvider, JudgeRunInput, JudgeRunResult } from '@/lib/judge/types';

// macOS ships Apple clang as `g++`, which lacks GCC's `<bits/stdc++.h>` catch-all
// header. The harness emits `#include <bits/stdc++.h>` (valid on Judge0's real
// GCC). For local verification we drop a shim header into the build dir and add
// it to the include path so the same source compiles on either toolchain.
const BITS_STDCPP_SHIM = `#pragma once
#include <algorithm>
#include <array>
#include <bitset>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <functional>
#include <iostream>
#include <iomanip>
#include <limits>
#include <list>
#include <map>
#include <numeric>
#include <queue>
#include <set>
#include <sstream>
#include <stack>
#include <string>
#include <tuple>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>
`;

// Deterministic, in-process execution provider for DEV / TEST / VERIFICATION ONLY.
//
// This is NOT a sandbox. It shells out to the host's compilers/interpreters
// (g++, javac/java, node) with a wall-clock timeout but no memory isolation, no
// syscall filtering, and no filesystem jail. Production judging MUST use Judge0
// (see judge0-provider.ts). The value here: it lets the harness + problem bank
// be verified end-to-end locally without a running Judge0.
//
// Supported `language` values:
//   echo            -> stdout = stdin            (used by the unit test suite)
//   javascript|node -> `node file.js`            (always available)
//   cpp|c++         -> g++ -O2 -std=c++17        (if g++ present)
//   java            -> javac Main.java && java   (if a JDK is present)

const COMPILE_TIMEOUT_MS = 20_000;

function which(cmd: string): boolean {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  return probe.status === 0;
}

function fail(stderr: string, startedAt: number): JudgeRunResult {
  return { status: 'error', stdout: '', stderr, exitCode: null, signal: null, runtimeMs: Date.now() - startedAt, memoryKb: null };
}

// Compiled artifacts are cached by (language, source-hash) so running the same
// source against many test cases compiles once. Persistent temp dirs are cleaned
// up on process exit. Dev/test scope only.
type Artifact = { cmd: string; args: string[]; dir: string } | { compileError: string };
const artifactCache = new Map<string, Artifact>();
const cacheDirs: string[] = [];
let cleanupRegistered = false;

function registerCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  process.once('exit', () => {
    for (const dir of cacheDirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    }
  });
}

function sourceKey(language: string, source: string): string {
  return `${language}:${createHash('sha1').update(source).digest('hex')}`;
}

function newCacheDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  cacheDirs.push(dir);
  registerCleanup();
  return dir;
}

export class LocalJudgeProvider implements JudgeProvider {
  id = 'local';

  async run(input: JudgeRunInput): Promise<JudgeRunResult> {
    const language = input.language.toLowerCase();

    if (language === 'echo') {
      return { status: 'ok', stdout: input.stdin, stderr: '', exitCode: 0, signal: null, runtimeMs: 0, memoryKb: null };
    }
    let artifact: Artifact;
    if (language === 'javascript' || language === 'node') artifact = this.buildJavaScript(input.source);
    else if (language === 'cpp' || language === 'c++') artifact = this.buildCpp(input.source);
    else if (language === 'java') artifact = this.buildJava(input.source);
    else return fail(`Local provider does not support language "${input.language}". Use Judge0 in production.`, Date.now());

    if ('compileError' in artifact) {
      return { status: 'compile_error', stdout: '', stderr: artifact.compileError, exitCode: null, signal: null, runtimeMs: 0, memoryKb: null };
    }
    return this.execute(artifact.cmd, artifact.args, input, artifact.dir);
  }

  private cached(language: string, source: string, build: () => Artifact): Artifact {
    const key = sourceKey(language, source);
    const hit = artifactCache.get(key);
    if (hit) return hit;
    const built = build();
    artifactCache.set(key, built);
    return built;
  }

  // ---- JavaScript ---------------------------------------------------------
  private buildJavaScript(source: string): Artifact {
    return this.cached('javascript', source, () => {
      const dir = newCacheDir('judge-js-');
      const file = join(dir, 'main.js');
      writeFileSync(file, source, 'utf8');
      return { cmd: 'node', args: [file], dir };
    });
  }

  // ---- C++ ----------------------------------------------------------------
  private buildCpp(source: string): Artifact {
    if (!which('g++')) return { compileError: 'g++ not found on host (local provider).' };
    return this.cached('cpp', source, () => {
      const dir = newCacheDir('judge-cpp-');
      const src = join(dir, 'main.cpp');
      const bin = join(dir, 'main.out');
      writeFileSync(src, source, 'utf8');
      mkdirSync(join(dir, 'bits'), { recursive: true });
      writeFileSync(join(dir, 'bits', 'stdc++.h'), BITS_STDCPP_SHIM, 'utf8');
      const compile = spawnSync('g++', ['-O2', '-std=c++17', `-I${dir}`, '-o', bin, src], {
        encoding: 'utf8',
        timeout: COMPILE_TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024,
      });
      if (compile.status !== 0) return { compileError: compile.stderr || 'compile failed' };
      return { cmd: bin, args: [], dir };
    });
  }

  // ---- Java ---------------------------------------------------------------
  private buildJava(source: string): Artifact {
    if (!which('javac') || !which('java')) return { compileError: 'JDK (javac/java) not found on host (local provider).' };
    return this.cached('java', source, () => {
      const dir = newCacheDir('judge-java-');
      // The harness emits `public class Main`, so the file must be Main.java.
      const src = join(dir, 'Main.java');
      writeFileSync(src, source, 'utf8');
      const compile = spawnSync('javac', ['-d', dir, src], {
        encoding: 'utf8',
        timeout: COMPILE_TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024,
      });
      if (compile.status !== 0) return { compileError: compile.stderr || 'compile failed' };
      return { cmd: 'java', args: ['-cp', dir, 'Main'], dir };
    });
  }

  // ---- Shared run step ----------------------------------------------------
  private execute(cmd: string, args: string[], input: JudgeRunInput, cwd: string): JudgeRunResult {
    const startedAt = Date.now();
    const result = spawnSync(cmd, args, {
      input: input.stdin,
      cwd,
      timeout: Math.max(1000, input.timeLimitMs),
      maxBuffer: 32 * 1024 * 1024,
      encoding: 'utf8',
    });
    const runtimeMs = Date.now() - startedAt;
    const timedOut = Boolean(result.error && 'code' in result.error && (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT');

    if (timedOut) {
      return { status: 'tle', stdout: result.stdout || '', stderr: result.stderr || '', exitCode: null, signal: 'SIGKILL', runtimeMs, memoryKb: null };
    }
    if (result.error) {
      return fail(String(result.error.message || result.error), startedAt);
    }
    return {
      status: result.status === 0 ? 'ok' : 'runtime_error',
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.status,
      signal: result.signal ?? null,
      runtimeMs,
      memoryKb: null,
    };
  }
}
