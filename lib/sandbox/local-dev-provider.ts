import { spawn } from 'child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import type {
  SandboxCommandResult,
  SandboxCleanupStatus,
  SandboxExecutionMetadata,
  SandboxOutputChunk,
  SandboxOutputStream,
  SandboxProvider,
  SandboxProviderMetadata,
  SandboxRunCommandInput,
  SandboxSnapshotInput,
  SandboxTestResult,
  WorkspaceFile,
} from './types';
import { isSimulatedTestCommand } from './simulated-provider';
import { createSandboxRunId } from './run-id';
import { getSandboxResourceLimits } from './resource-limits';
import { validateWorkspaceManifest } from './workspace-manifest';

const DEFAULT_ALLOWED_COMMANDS = ['npm test'];
const INTERNAL_DIR = '.hirewave';
const TEST_RESULTS_PATH = `${INTERNAL_DIR}/test-results.json`;
const SNAPSHOT_EXCLUDES = new Set(['.git', 'node_modules', INTERNAL_DIR]);
const LOCAL_DEV_EXPOSED_ENV_KEYS = ['NODE_ENV', 'PATH'];

const CHECKOUT_RUNNER = String.raw`import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

const cart = read('src/cart.ts');
const payment = read('src/payment.ts');
const checkout = read('src/checkout.ts');
const readme = read('README.md');
const solutionPlan = read('src/solution-plan.ts');
const customTaskTest = read('tests/custom-task.test.ts');
const hasCheckoutWorkspace = Boolean(cart && payment && checkout);
const hasTodos = /TODO/i.test(solutionPlan);
const hasConcreteRootCause = /rootCause\s*=\s*['"\`][\s\S]{30,}?['"\`]/.test(solutionPlan) && !/rootCause\s*=\s*['"\`][^'"\`]*TODO/i.test(solutionPlan);
const riskControlMatches = solutionPlan.match(/riskControls\s*=\s*\[[\s\S]*?\]/);
const riskControlCount = (riskControlMatches && riskControlMatches[0].match(/['"\`][\s\S]*?['"\`]/g) || []).length;
const verificationMatches = solutionPlan.match(/verificationEvidence\s*=\s*\[[\s\S]*?\]/);
const verificationCount = (verificationMatches && verificationMatches[0].match(/['"\`][\s\S]*?['"\`]/g) || []).length;

const tests = hasCheckoutWorkspace ? [
  {
    name: 'rejects zero, negative, and non-integer quantities',
    status: (/quantity\s*<=\s*0|quantity\s*<\s*1/.test(cart) && /Number\.isInteger\(.*quantity/.test(cart) && /throw new Error\([^)]*quantity/i.test(cart)) ? 'passed' : 'failed',
    message: 'Cart validation should reject zero, negative, and non-integer quantities with a clear quantity error.'
  },
  {
    name: 'passes payment idempotency key on charge',
    status: /idempotencyKey/.test(payment) && /idempotencyKey/.test(checkout) ? 'passed' : 'failed',
    message: 'Payment charge should accept and receive an idempotencyKey so retries do not double charge.'
  },
  {
    name: 'rolls back inventory when payment fails',
    status: /try\s*{[\s\S]*chargeCard[\s\S]*}\s*catch/.test(checkout) && /rollbackInventory/.test(checkout) ? 'passed' : 'failed',
    message: 'Checkout should catch payment failures and call rollbackInventory before rethrowing a useful error.'
  },
  {
    name: 'preserves useful payment error context',
    status: /catch\s*\([^)]*(error|err)/.test(checkout) && (/throw\s+(error|err)/.test(checkout) || /Payment/.test(checkout)) ? 'passed' : 'failed',
    message: 'The caller should receive useful payment failure context instead of a generic checkout failure.'
  }
] : [
  {
    name: 'keeps a candidate-facing task brief',
    status: readme.length > 40 ? 'passed' : 'failed',
    message: 'Custom challenge templates should include a README brief with enough candidate-facing context.'
  },
  {
    name: 'documents a concrete root cause',
    status: hasConcreteRootCause && !hasTodos ? 'passed' : 'failed',
    message: 'src/solution-plan.ts should replace TODO root-cause text with a concrete explanation.'
  },
  {
    name: 'records at least two risk controls',
    status: riskControlCount >= 2 && !hasTodos ? 'passed' : 'failed',
    message: 'src/solution-plan.ts should include at least two reviewed risk controls or invariants.'
  },
  {
    name: 'records verification evidence',
    status: Boolean(customTaskTest) && verificationCount >= 1 && !hasTodos ? 'passed' : 'failed',
    message: 'The task should keep test scaffolding and verification evidence for reviewer audit.'
  }
];

const failed = tests.filter((test) => test.status === 'failed').length;
const passed = tests.length - failed;
const output = [
  hasCheckoutWorkspace ? 'Local checkout test runner' : 'Local custom task runner',
  '',
  ...tests.map((test) => (test.status === 'passed' ? 'PASS' : 'FAIL') + ' ' + test.name),
  '',
  'Result: ' + passed + '/' + tests.length + ' passed'
].join('\n');

console.log(output);
mkdirSync('.hirewave', { recursive: true });
writeFileSync('.hirewave/test-results.json', JSON.stringify({ tests }, null, 2));
process.exit(failed === 0 ? 0 : 1);
`;

function metadata(): SandboxProviderMetadata {
  return {
    id: 'local-dev',
    kind: 'local-dev',
    executionMode: 'local_process',
    isolationLevel: 'host_temp_directory',
    networkAccess: 'host_inherited',
    networkPolicy: {
      mode: 'host_inherited',
      outboundAccess: 'host_inherited',
      allowedHosts: [],
      blockedByDefault: false,
    },
    capabilities: {
      readiness: 'local_dev_only',
      realCodeExecution: 'partial',
      productionIsolation: 'not_supported',
      commandPolicy: 'supported',
      networkPolicy: 'not_supported',
      environmentPolicy: 'supported',
      resourceLimits: 'partial',
      workspaceSnapshots: 'supported',
      cleanupEvidence: 'supported',
    },
    filesystemPersistence: 'ephemeral_temp_directory',
    cleanupPolicy: process.env.SANDBOX_LOCAL_DEV_KEEP_WORKSPACE === 'true' ? 'manual_retention' : 'delete_after_run',
    environmentPolicy: {
      mode: 'minimal_allowlist',
      exposedEnvKeys: LOCAL_DEV_EXPOSED_ENV_KEYS,
      secretsExposed: false,
    },
    resourceLimits: getSandboxResourceLimits(),
    commandPolicy: {
      mode: 'exact_allowlist',
      allowedCommands: splitAllowedCommands(),
      blockedByDefault: true,
    },
  };
}

function splitAllowedCommands() {
  const configured = process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS;
  return (configured ? configured.split(',') : DEFAULT_ALLOWED_COMMANDS)
    .map((command) => command.trim())
    .filter(Boolean);
}

function splitCommand(command: string) {
  return command.trim().split(/\s+/).filter(Boolean);
}

function outputFromChunks(chunks: SandboxOutputChunk[]) {
  return chunks.map((chunk) => chunk.content).join('').trimEnd();
}

function hasWorkspaceFile(files: WorkspaceFile[], targetPath: string) {
  return files.some((file) => file.path === targetPath);
}

function prepareWorkspaceFiles(files: WorkspaceFile[]) {
  const generatedPaths = new Set<string>([`${INTERNAL_DIR}/run-checkout-tests.mjs`]);
  const prepared = files.map((file) => ({ ...file }));

  if (!hasWorkspaceFile(prepared, 'package.json')) {
    generatedPaths.add('package.json');
    prepared.push({
      path: 'package.json',
      language: 'json',
      content: JSON.stringify(
        {
          name: 'hirewave-sandbox-workspace',
          private: true,
          type: 'module',
          scripts: {
            test: 'node .hirewave/run-checkout-tests.mjs',
          },
        },
        null,
        2,
      ),
    });
  }

  prepared.push({
    path: `${INTERNAL_DIR}/run-checkout-tests.mjs`,
    language: 'javascript',
    content: CHECKOUT_RUNNER,
  });

  return { files: prepared, generatedPaths };
}

function isPathInside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function writeWorkspaceFiles(root: string, files: WorkspaceFile[]) {
  for (const file of files) {
    const target = path.resolve(root, file.path);
    if (!isPathInside(root, target)) {
      throw new Error(`Refusing to write sandbox file outside workspace: ${file.path}`);
    }

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content, 'utf8');
  }
}

async function readWorkspaceSnapshot(
  root: string,
  directory = root,
  generatedPaths = new Set<string>(),
): Promise<WorkspaceFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: WorkspaceFile[] = [];

  for (const entry of entries) {
    if (SNAPSHOT_EXCLUDES.has(entry.name)) continue;

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readWorkspaceSnapshot(root, fullPath, generatedPaths)));
      continue;
    }

    if (!entry.isFile()) continue;

    const relativePath = path.relative(root, fullPath).split(path.sep).join('/');
    if (generatedPaths.has(relativePath)) continue;

    files.push({
      path: relativePath,
      language: path.extname(relativePath).replace(/^\./, '') || 'text',
      content: await readFile(fullPath, 'utf8'),
    });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function readTestResults(root: string): Promise<SandboxTestResult[]> {
  try {
    const content = await readFile(path.join(root, TEST_RESULTS_PATH), 'utf8');
    const parsed = JSON.parse(content) as { tests?: unknown };
    if (!Array.isArray(parsed.tests)) return [];

    return parsed.tests.flatMap((test) => {
      if (!test || typeof test !== 'object') return [];
      const candidate = test as { name?: unknown; status?: unknown; message?: unknown; durationMs?: unknown };
      if (typeof candidate.name !== 'string') return [];
      if (candidate.status !== 'passed' && candidate.status !== 'failed') return [];
      const status = candidate.status;

      return [{
        name: candidate.name,
        status,
        message: typeof candidate.message === 'string' ? candidate.message : '',
        durationMs: typeof candidate.durationMs === 'number' ? candidate.durationMs : undefined,
      }];
    });
  } catch {
    return [];
  }
}

function disabledResult(
  command: string,
  reason: string,
  skippedReason = reason,
  sandboxRunId = createSandboxRunId('local-dev'),
): SandboxCommandResult {
  const outputChunks: SandboxOutputChunk[] = [
    { stream: 'system', content: `$ ${command}\n` },
    { stream: 'stderr', content: reason },
  ];
  const output = outputFromChunks(outputChunks);

  return {
    status: 'failed',
    exitCode: 126,
    output,
    outputChunks,
    tests: [],
    provider: metadata(),
    execution: {
      sandboxRunId,
      durationMs: 0,
      timedOut: false,
      cleanupStatus: 'not_applicable',
      outputChars: output.length,
      outputTruncated: false,
      skippedReason,
    },
    snapshots: [],
  };
}

function runProcess(input: { command: string; cwd: string; timeoutMs: number; outputLimitChars: number; sandboxRunId: string }) {
  return new Promise<{
    exitCode: number;
    output: string;
    outputChunks: SandboxOutputChunk[];
    execution: SandboxExecutionMetadata;
  }>((resolve) => {
    const startedAt = Date.now();
    const [binary, ...args] = splitCommand(input.command);
    if (!binary) {
      const output = 'No command provided.';
      resolve({
        exitCode: 1,
        output,
        outputChunks: [{ stream: 'system', content: output }],
        execution: {
          sandboxRunId: input.sandboxRunId,
          durationMs: Date.now() - startedAt,
          timedOut: false,
          cleanupStatus: 'not_applicable',
          timeoutMs: input.timeoutMs,
          outputChars: output.length,
          outputLimitChars: input.outputLimitChars,
          outputTruncated: false,
        },
      });
      return;
    }

    const child = spawn(binary, args, {
      cwd: input.cwd,
      env: {
        NODE_ENV: 'test',
        PATH: process.env.PATH || '',
      },
      shell: false,
    });

    const chunks: SandboxOutputChunk[] = [];
    let outputChars = 0;
    let outputTruncated = false;
    let timedOut = false;

    const appendOutput = (stream: SandboxOutputStream, value: string) => {
      outputChars += value.length;

      if (outputTruncated) return;

      const currentLength = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
      const remaining = input.outputLimitChars - currentLength;
      if (remaining <= 0) {
        outputTruncated = true;
        return;
      }

      if (value.length > remaining) {
        chunks.push({ stream, content: value.slice(0, remaining), truncated: true });
        outputTruncated = true;
        return;
      }

      chunks.push({ stream, content: value });
    };

    appendOutput('system', `$ ${input.command}\n`);
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
      appendOutput('system', `Command timed out after ${input.timeoutMs}ms.`);
    }, input.timeoutMs);

    child.stdout.on('data', (chunk) => appendOutput('stdout', String(chunk)));
    child.stderr.on('data', (chunk) => appendOutput('stderr', String(chunk)));
    child.on('close', (code, signal) => {
      clearTimeout(timeout);
      const outputChunks = outputTruncated
        ? [...chunks, { stream: 'system' as const, content: `[output truncated after ${input.outputLimitChars} chars]` }]
        : chunks;
      const output = [
        outputFromChunks(chunks),
        outputTruncated ? `[output truncated after ${input.outputLimitChars} chars]` : '',
      ].filter(Boolean).join('\n');

      resolve({
        exitCode: signal ? 124 : code ?? 1,
        output,
        outputChunks,
        execution: {
          sandboxRunId: input.sandboxRunId,
          durationMs: Date.now() - startedAt,
          timedOut,
          cleanupStatus: 'not_applicable',
          timeoutMs: input.timeoutMs,
          outputChars,
          outputLimitChars: input.outputLimitChars,
          outputTruncated,
        },
      });
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      appendOutput('stderr', error.message);
      const outputChunks = outputTruncated
        ? [...chunks, { stream: 'system' as const, content: `[output truncated after ${input.outputLimitChars} chars]` }]
        : chunks;
      const output = [
        outputFromChunks(chunks),
        outputTruncated ? `[output truncated after ${input.outputLimitChars} chars]` : '',
      ].filter(Boolean).join('\n');

      resolve({
        exitCode: 127,
        output,
        outputChunks,
        execution: {
          sandboxRunId: input.sandboxRunId,
          durationMs: Date.now() - startedAt,
          timedOut,
          cleanupStatus: 'not_applicable',
          timeoutMs: input.timeoutMs,
          outputChars,
          outputLimitChars: input.outputLimitChars,
          outputTruncated,
        },
      });
    });
  });
}

function cleanupErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown cleanup error';
}

async function cleanupWorkspace(root: string): Promise<{ cleanupStatus: SandboxCleanupStatus; cleanupError?: string }> {
  if (process.env.SANDBOX_LOCAL_DEV_KEEP_WORKSPACE === 'true') {
    return { cleanupStatus: 'retained' };
  }

  try {
    await rm(root, { recursive: true, force: true });
    return { cleanupStatus: 'deleted' };
  } catch (error) {
    return { cleanupStatus: 'failed', cleanupError: cleanupErrorMessage(error) };
  }
}

export class LocalDevSandboxProvider implements SandboxProvider {
  readonly id = 'local-dev';
  readonly kind = 'local-dev';

  metadata() {
    return metadata();
  }

  isTestCommand(command: string) {
    return isSimulatedTestCommand(command);
  }

  async runCommand(input: SandboxRunCommandInput): Promise<SandboxCommandResult> {
    const sandboxRunId = createSandboxRunId(this.id);
    const manifestValidation = validateWorkspaceManifest(input.files, input.workspaceManifest);
    if (!manifestValidation.ok) {
      return disabledResult(
        input.command,
        'Workspace manifest did not match mounted files.',
        'workspace_manifest_mismatch',
        sandboxRunId,
      );
    }

    if (process.env.NODE_ENV === 'production') {
      return disabledResult(
        input.command,
        'Local dev sandbox provider cannot execute commands in production. Use a configured external sandbox provider.',
        'local_dev_production_blocked',
        sandboxRunId,
      );
    }

    if (process.env.SANDBOX_LOCAL_DEV_ENABLED !== 'true') {
      return disabledResult(
        input.command,
        'Local dev sandbox provider is configured but disabled. Set SANDBOX_LOCAL_DEV_ENABLED=true for local-only command execution.',
        'local_dev_disabled',
        sandboxRunId,
      );
    }

    const allowedCommands = splitAllowedCommands();
    if (!allowedCommands.includes(input.command.trim())) {
      return disabledResult(
        input.command,
        `Command is not allowed for local dev sandbox execution. Allowed commands: ${allowedCommands.join(', ')}.`,
        'command_not_allowed',
        sandboxRunId,
      );
    }

    const workspaceRoot = await mkdtemp(path.join(tmpdir(), `hirewave-${input.sessionId}-`));
    const resourceLimits = getSandboxResourceLimits();
    const timeoutMs = resourceLimits.executionTimeoutMs;
    const outputLimitChars = resourceLimits.outputLimitChars;

    let result: SandboxCommandResult | null = null;
    let providerError: unknown;
    try {
      const prepared = prepareWorkspaceFiles(input.files);
      await writeWorkspaceFiles(workspaceRoot, prepared.files);
      const run = await runProcess({
        command: input.command.trim(),
        cwd: workspaceRoot,
        timeoutMs,
        outputLimitChars,
        sandboxRunId,
      });
      const tests = await readTestResults(workspaceRoot);
      const snapshots = await this.snapshot({
        sessionId: input.sessionId,
        files: input.files,
        root: workspaceRoot,
        generatedPaths: prepared.generatedPaths,
      });

      result = {
        status: run.exitCode === 0 ? 'succeeded' : 'failed',
        exitCode: run.exitCode,
        output: run.output,
        outputChunks: run.outputChunks,
        tests,
        provider: metadata(),
        execution: run.execution,
        snapshots,
      };
    } catch (error) {
      providerError = error;
    }

    const cleanup = await cleanupWorkspace(workspaceRoot);
    if (providerError) {
      throw providerError;
    }

    if (!result) throw new Error('Local dev sandbox did not produce a command result.');
    return {
      ...result,
      execution: {
        ...result.execution,
        ...cleanup,
      },
    };
  }

  async snapshot(input: SandboxSnapshotInput & { root?: string; generatedPaths?: Set<string> }) {
    if (!input.root) return input.files.map((file) => ({ ...file }));
    return readWorkspaceSnapshot(input.root, input.root, input.generatedPaths);
  }
}
