import type {
  SandboxCommandResult,
  SandboxOutputChunk,
  SandboxOutputStream,
  SandboxProvider,
  SandboxProviderMetadata,
  SandboxRunCommandInput,
  SandboxSnapshotInput,
  WorkspaceFile,
} from './types';
import { getSandboxResourceLimits } from './resource-limits';
import { createSandboxRunId } from './run-id';
import { validateWorkspaceManifest } from './workspace-manifest';

export type { WorkspaceFile } from './types';

export type SimulatedTest = {
  name: string;
  status: 'passed' | 'failed';
  message: string;
};

export type SimulatedCommandResult = {
  status: 'succeeded' | 'failed';
  exitCode: number;
  output: string;
  outputChunks: SandboxOutputChunk[];
  tests: SimulatedTest[];
  skippedReason?: string;
};

const SIMULATED_ALLOWED_COMMANDS = ['npm test', 'ls', 'ls src', 'cat <path>', 'pwd'];

function file(files: WorkspaceFile[], path: string) {
  return files.find((candidate) => candidate.path === path)?.content || '';
}

function hasFile(files: WorkspaceFile[], path: string) {
  return files.some((candidate) => candidate.path === path);
}

function filesWithPrefix(files: WorkspaceFile[], prefix: string) {
  return files
    .filter((candidate) => candidate.path.startsWith(prefix))
    .map((candidate) => candidate.content)
    .join('\n');
}

function isNotificationWorkspace(files: WorkspaceFile[]) {
  return hasFile(files, 'BRIEF.md') &&
    hasFile(files, 'tests/notification-system.test.ts') &&
    hasFile(files, 'backend/src/server.ts') &&
    hasFile(files, 'frontend/pages/dashboard.tsx');
}

function hasNotificationPreferenceGuard(source: string) {
  const profileFetchIndex = source.search(/\bgetUserProfile\s*\(/);
  const preferenceGuardIndex = source.search(
    /if\s*\([^)]*(?:!\s*[\w.]+\.inAppEnabled|[\w.]+\.inAppEnabled\s*(?:===|==)\s*false|false\s*(?:===|==)\s*[\w.]+\.inAppEnabled)[^)]*\)\s*(?:\{[\s\S]{0,160}?\breturn\b|\breturn\b)/,
  );
  const deliveryIndex = source.search(/\b(?:publish|deliver|sendNotification|relayNotification)\s*\(|\.(?:publish|send|emit)\s*\(/);

  return profileFetchIndex !== -1 &&
    preferenceGuardIndex !== -1 &&
    profileFetchIndex < preferenceGuardIndex &&
    (deliveryIndex === -1 || preferenceGuardIndex < deliveryIndex);
}

function hasClientIdDedupe(source: string) {
  return (
    /\b(?:some|find|filter)\s*\([\s\S]{0,260}?(?:\.id\s*(?:===|==)\s*[\w.]+\.id|[\w.]+\.id\s*(?:===|==)\s*[\w.]+\.id)/.test(source) ||
    /new\s+Set\s*\([\s\S]{0,220}?\.map\s*\([\s\S]{0,160}?=>[\s\S]{0,100}?\.id[\s\S]{0,220}?\)\s*\)[\s\S]{0,260}?\.has\s*\(\s*[\w.]+\.id\s*\)/.test(source) ||
    /new\s+Map\s*\([\s\S]{0,360}?\.id[\s\S]{0,360}?\)[\s\S]{0,260}?\.(?:has|get)\s*\(\s*[\w.]+\.id\s*\)/.test(source)
  );
}

function hasRedisPubSubRelay(source: string) {
  const publishes = /\.publish\s*\(|\bpublish\s*\(/i.test(source);
  const subscribes = /\.subscribe\s*\(|\bsubscribe\s*\(/i.test(source);
  const relaysMessage = /\.(?:send|emit)\s*\(|\bsend\s*\(|\brelay\w*\s*\(|\.on\s*\(\s*['"`]message['"`]/i.test(source);
  const hasSeparateFactoryClients =
    /function\s+createPublisher\s*\([^)]*\)\s*{[\s\S]{0,220}?(?:new\s+Redis\s*\(|\.duplicate\s*\()[\s\S]{0,220}?}[\s\S]{0,500}?function\s+createSubscriber\s*\([^)]*\)\s*{[\s\S]{0,220}?(?:new\s+Redis\s*\(|\.duplicate\s*\()/i.test(source) ||
    /function\s+createSubscriber\s*\([^)]*\)\s*{[\s\S]{0,220}?(?:new\s+Redis\s*\(|\.duplicate\s*\()[\s\S]{0,220}?}[\s\S]{0,500}?function\s+createPublisher\s*\([^)]*\)\s*{[\s\S]{0,220}?(?:new\s+Redis\s*\(|\.duplicate\s*\()/i.test(source);

  return publishes &&
    subscribes &&
    relaysMessage &&
    hasSeparateFactoryClients;
}

export function runSimulatedCheckoutTests(files: WorkspaceFile[]): SimulatedCommandResult {
  const cart = file(files, 'src/cart.ts');
  const payment = file(files, 'src/payment.ts');
  const checkout = file(files, 'src/checkout.ts');

  const tests: SimulatedTest[] = [
    {
      name: 'rejects zero, negative, and non-integer quantities',
      status:
        (/quantity\s*<=\s*0|quantity\s*<\s*1/.test(cart) &&
        /Number\.isInteger\(.*quantity/.test(cart)) &&
        /throw new Error\([^)]*quantity/i.test(cart)
          ? 'passed'
          : 'failed',
      message:
        'Cart validation should reject zero, negative, and non-integer quantities with a clear quantity error.',
    },
    {
      name: 'passes payment idempotency key on charge',
      status: /idempotencyKey/.test(payment) && /idempotencyKey/.test(checkout) ? 'passed' : 'failed',
      message:
        'Payment charge should accept and receive an idempotencyKey so retries do not double charge.',
    },
    {
      name: 'rolls back inventory when payment fails',
      status: /try\s*{[\s\S]*chargeCard[\s\S]*}\s*catch/.test(checkout) && /rollbackInventory/.test(checkout)
        ? 'passed'
        : 'failed',
      message:
        'Checkout should catch payment failures and call rollbackInventory before rethrowing a useful error.',
    },
    {
      name: 'preserves useful payment error context',
      status:
        /catch\s*\([^)]*(error|err)/.test(checkout) &&
        (/throw\s+(error|err)/.test(checkout) || /Payment/.test(checkout))
          ? 'passed'
          : 'failed',
      message:
        'The caller should receive useful payment failure context instead of a generic checkout failure.',
    },
  ];

  const failed = tests.filter((test) => test.status === 'failed').length;
  const passed = tests.length - failed;
  const outputLines = [
    'Simulated checkout test runner',
    '',
    ...tests.map((test) => `${test.status === 'passed' ? 'PASS' : 'FAIL'} ${test.name}`),
    '',
    `Result: ${passed}/${tests.length} passed`,
  ];

  return {
    status: failed === 0 ? 'succeeded' : 'failed',
    exitCode: failed === 0 ? 0 : 1,
    output: outputLines.join('\n'),
    outputChunks: [{ stream: 'stdout', content: outputLines.join('\n') }],
    tests,
  };
}

export function runSimulatedNotificationTests(files: WorkspaceFile[]): SimulatedCommandResult {
  const server = file(files, 'backend/src/server.ts');
  const rateLimit = file(files, 'backend/src/rate-limit.ts');
  const idempotency = file(files, 'backend/src/idempotency.ts');
  const dashboard = file(files, 'frontend/pages/dashboard.tsx');
  const display = file(files, 'frontend/components/NotificationDisplay.tsx');
  const backend = filesWithPrefix(files, 'backend/src/');

  const tests: SimulatedTest[] = [
    {
      name: 'enforces per-user per-type rate limits with Redis TTL',
      status:
        /incr\s*\(/i.test(rateLimit) &&
        /expire\s*\(/i.test(rateLimit) &&
        /userId/.test(rateLimit) &&
        /type/.test(rateLimit) &&
        /<=\s*5|<\s*6|>\s*5/.test(rateLimit)
          ? 'passed'
          : 'failed',
      message:
        'Rate limiting should increment a Redis key scoped by user and type, expire it after one minute, and enforce the 5/minute limit.',
    },
    {
      name: 'deduplicates notifications atomically for five minutes',
      status:
        /(createHash|sha256)/i.test(idempotency) &&
        /set\s*\(/i.test(idempotency) &&
        /\bNX\b/.test(idempotency) &&
        /\bEX\b|\bPX\b/.test(idempotency) &&
        /300|5\s*\*\s*60/.test(idempotency)
          ? 'passed'
          : 'failed',
      message:
        'Idempotency should use a stable payload hash and an atomic Redis set with NX plus a five-minute TTL.',
    },
    {
      name: 'respects in-app notification preferences before delivery',
      status: hasNotificationPreferenceGuard(server) ? 'passed' : 'failed',
      message:
        'The notification endpoint should read UserProfile preferences and skip in-app delivery when inAppEnabled is false.',
    },
    {
      name: 'cleans up dashboard WebSocket subscriptions',
      status:
        /useEffect\s*\(/.test(dashboard) &&
        /return\s*\(?\s*\)?\s*=>[\s\S]*\.close\s*\(/.test(dashboard) &&
        /},\s*\[[^\]]*\]\s*\)/.test(dashboard)
          ? 'passed'
          : 'failed',
      message:
        'The dashboard should create one WebSocket subscription with stable dependencies and close it during cleanup.',
    },
    {
      name: 'deduplicates client display by canonical notification id',
      status: hasClientIdDedupe(display) ? 'passed' : 'failed',
      message:
        'NotificationDisplay merge logic should avoid rendering duplicate notifications with the same canonical id.',
    },
    {
      name: 'relays notifications through Redis Pub/Sub clients',
      status: hasRedisPubSubRelay(backend) ? 'passed' : 'failed',
      message:
        'Backend delivery should publish notifications, subscribe to the channel, relay messages to clients, and use separate Redis publisher/subscriber clients where practical.',
    },
  ];

  const failed = tests.filter((test) => test.status === 'failed').length;
  const passed = tests.length - failed;
  const outputLines = [
    'Simulated notification system runner',
    '',
    ...tests.map((test) => `${test.status === 'passed' ? 'PASS' : 'FAIL'} ${test.name}`),
    '',
    `Result: ${passed}/${tests.length} passed`,
  ];

  return {
    status: failed === 0 ? 'succeeded' : 'failed',
    exitCode: failed === 0 ? 0 : 1,
    output: outputLines.join('\n'),
    outputChunks: [{ stream: 'stdout', content: outputLines.join('\n') }],
    tests,
  };
}

export function runSimulatedGenericTaskTests(files: WorkspaceFile[]): SimulatedCommandResult {
  const readme = file(files, 'README.md');
  const solutionPlan = file(files, 'src/solution-plan.ts');
  const testFile = files.find((candidate) => candidate.path.startsWith('tests/') && candidate.path.endsWith('.test.ts'));
  const hasTodos = /TODO/i.test(solutionPlan);
  const hasConcreteRootCause = /rootCause\s*=\s*['"`][\s\S]{30,}?['"`]/.test(solutionPlan) && !/rootCause\s*=\s*['"`][^'"`]*TODO/i.test(solutionPlan);
  const riskControlMatches = solutionPlan.match(/riskControls\s*=\s*\[[\s\S]*?\]/);
  const riskControlCount = riskControlMatches?.[0].match(/['"`][\s\S]*?['"`]/g)?.length || 0;
  const verificationMatches = solutionPlan.match(/verificationEvidence\s*=\s*\[[\s\S]*?\]/);
  const verificationCount = verificationMatches?.[0].match(/['"`][\s\S]*?['"`]/g)?.length || 0;

  const tests: SimulatedTest[] = [
    {
      name: 'keeps a candidate-facing task brief',
      status: readme.length > 40 ? 'passed' : 'failed',
      message: 'Custom challenge templates should include a README brief with enough candidate-facing context.',
    },
    {
      name: 'documents a concrete root cause',
      status: hasConcreteRootCause && !hasTodos ? 'passed' : 'failed',
      message: 'src/solution-plan.ts should replace TODO root-cause text with a concrete explanation.',
    },
    {
      name: 'records at least two risk controls',
      status: riskControlCount >= 2 && !hasTodos ? 'passed' : 'failed',
      message: 'src/solution-plan.ts should include at least two reviewed risk controls or invariants.',
    },
    {
      name: 'records verification evidence',
      status: Boolean(testFile) && verificationCount >= 1 && !hasTodos ? 'passed' : 'failed',
      message: 'The task should keep test scaffolding and verification evidence for reviewer audit.',
    },
  ];

  const failed = tests.filter((test) => test.status === 'failed').length;
  const passed = tests.length - failed;
  const outputLines = [
    'Simulated custom task runner',
    '',
    ...tests.map((test) => `${test.status === 'passed' ? 'PASS' : 'FAIL'} ${test.name}`),
    '',
    `Result: ${passed}/${tests.length} passed`,
  ];

  return {
    status: failed === 0 ? 'succeeded' : 'failed',
    exitCode: failed === 0 ? 0 : 1,
    output: outputLines.join('\n'),
    outputChunks: [{ stream: 'stdout', content: outputLines.join('\n') }],
    tests,
  };
}

function normalizeCommandPath(path: string) {
  return path.replace(/^\.\/+/, '').replace(/\/+$/, '');
}

function splitCommand(command: string) {
  return command.trim().split(/\s+/).filter(Boolean);
}

function outputFromChunks(chunks: SandboxOutputChunk[]) {
  return chunks.map((chunk) => chunk.content).join('').trimEnd();
}

function shellOutputResult(command: string, body: string, stream: SandboxOutputStream = 'stdout') {
  const outputChunks: SandboxOutputChunk[] = [
    { stream: 'system', content: `$ ${command.trim()}\n` },
    { stream, content: body },
  ];
  return {
    output: outputFromChunks(outputChunks),
    outputChunks,
  };
}

function workspaceManifestMismatchResult(command: string) {
  const output = shellOutputResult(command, 'Workspace manifest did not match mounted files.', 'stderr');
  return {
    status: 'failed' as const,
    exitCode: 126,
    ...output,
    tests: [],
    skippedReason: 'workspace_manifest_mismatch',
  };
}

function listDirectory(files: WorkspaceFile[], requestedPath: string) {
  const directory = normalizeCommandPath(requestedPath || '.');
  const prefix = directory === '.' ? '' : `${directory}/`;
  const entries = new Set<string>();

  for (const workspaceFile of files) {
    if (directory !== '.' && !workspaceFile.path.startsWith(prefix)) continue;
    const remaining = directory === '.' ? workspaceFile.path : workspaceFile.path.slice(prefix.length);
    const [entry] = remaining.split('/');
    if (entry) entries.add(entry);
  }

  return Array.from(entries).sort((a, b) => a.localeCompare(b));
}

export function isSimulatedTestCommand(command: string) {
  const normalized = command.trim().toLowerCase();
  return /^(npm|pnpm|yarn)\s+(run\s+)?test\b/.test(normalized) ||
    /^npx\s+(jest|vitest)\b/.test(normalized);
}

export function runSimulatedCommand(command: string, files: WorkspaceFile[]): SimulatedCommandResult {
  const normalized = command.trim();
  const parts = splitCommand(normalized);
  const [binary, ...args] = parts;

  if (!normalized) {
    return {
      status: 'failed',
      exitCode: 1,
      output: 'No command provided.',
      outputChunks: [{ stream: 'system', content: 'No command provided.' }],
      tests: [],
    };
  }

  if (isSimulatedTestCommand(normalized)) {
    let result: SimulatedCommandResult;
    if (isNotificationWorkspace(files)) {
      result = runSimulatedNotificationTests(files);
    } else if (hasFile(files, 'src/cart.ts') && hasFile(files, 'src/payment.ts') && hasFile(files, 'src/checkout.ts')) {
      result = runSimulatedCheckoutTests(files);
    } else {
      result = runSimulatedGenericTaskTests(files);
    }

    const output = shellOutputResult(normalized, result.output);
    return {
      ...result,
      ...output,
    };
  }

  if (binary === 'pwd') {
    const output = shellOutputResult(normalized, '/workspace');
    return {
      status: 'succeeded',
      exitCode: 0,
      ...output,
      tests: [],
    };
  }

  if (binary === 'ls') {
    const pathArg = args.filter((arg) => !arg.startsWith('-'))[0] || '.';
    const entries = listDirectory(files, pathArg);
    const output = shellOutputResult(
      normalized,
      entries.length ? entries.join('\n') : `ls: cannot access '${pathArg}': No such file or directory`,
      entries.length ? 'stdout' : 'stderr',
    );
    return {
      status: entries.length ? 'succeeded' : 'failed',
      exitCode: entries.length ? 0 : 1,
      ...output,
      tests: [],
    };
  }

  if (binary === 'cat') {
    const pathArg = normalizeCommandPath(args[0] || '');
    const target = files.find((workspaceFile) => workspaceFile.path === pathArg);
    const output = shellOutputResult(
      normalized,
      target ? target.content : `cat: ${pathArg || '<missing path>'}: No such file`,
      target ? 'stdout' : 'stderr',
    );

    return {
      status: target ? 'succeeded' : 'failed',
      exitCode: target ? 0 : 1,
      ...output,
      tests: [],
    };
  }

  const output = shellOutputResult(
    normalized,
    [
      `Command not available in this MVP sandbox: ${binary || normalized}`,
      'Supported commands: npm test, ls, ls src, cat <path>, pwd.',
    ].join('\n'),
    'stderr',
  );
  return {
    status: 'failed',
    exitCode: 127,
    ...output,
    tests: [],
    skippedReason: 'command_not_allowed',
  };
}

export class SimulatedSandboxProvider implements SandboxProvider {
  readonly id = 'simulated';
  readonly kind = 'simulated' as const;

  metadata(): SandboxProviderMetadata {
    return {
      id: this.id,
      kind: this.kind,
      executionMode: 'simulated' as const,
      isolationLevel: 'none' as const,
      networkAccess: 'none' as const,
      networkPolicy: {
        mode: 'none' as const,
        outboundAccess: 'none' as const,
        allowedHosts: [],
        blockedByDefault: true,
      },
      capabilities: {
        readiness: 'demo_only' as const,
        realCodeExecution: 'not_supported' as const,
        productionIsolation: 'not_supported' as const,
        commandPolicy: 'supported' as const,
        networkPolicy: 'not_applicable' as const,
        environmentPolicy: 'not_applicable' as const,
        resourceLimits: 'not_applicable' as const,
        workspaceSnapshots: 'supported' as const,
        cleanupEvidence: 'not_applicable' as const,
      },
      filesystemPersistence: 'virtual' as const,
      cleanupPolicy: 'not_applicable' as const,
      environmentPolicy: {
        mode: 'none' as const,
        exposedEnvKeys: [],
        secretsExposed: false,
      },
      resourceLimits: getSandboxResourceLimits(),
      commandPolicy: {
        mode: 'simulated_allowlist' as const,
        allowedCommands: SIMULATED_ALLOWED_COMMANDS,
        blockedByDefault: true,
      },
    };
  }

  isTestCommand(command: string) {
    return isSimulatedTestCommand(command);
  }

  async runCommand(input: SandboxRunCommandInput): Promise<SandboxCommandResult> {
    const startedAt = Date.now();
    const sandboxRunId = createSandboxRunId(this.id);
    const manifestValidation = validateWorkspaceManifest(input.files, input.workspaceManifest);
    if (!manifestValidation.ok) {
      const result = workspaceManifestMismatchResult(input.command);
      return {
        ...result,
        provider: this.metadata(),
        execution: {
          sandboxRunId,
          durationMs: 0,
          timedOut: false,
          cleanupStatus: 'not_applicable',
          outputChars: result.output.length,
          outputTruncated: false,
          skippedReason: result.skippedReason,
        },
        snapshots: [],
      };
    }

    const result = runSimulatedCommand(input.command, input.files);

    return {
      ...result,
      provider: this.metadata(),
      execution: {
        sandboxRunId,
        durationMs: Date.now() - startedAt,
        timedOut: false,
        cleanupStatus: 'not_applicable',
        outputChars: result.output.length,
        outputTruncated: false,
        skippedReason: result.skippedReason,
      },
      snapshots: await this.snapshot({ sessionId: input.sessionId, files: input.files }),
    };
  }

  async snapshot(input: SandboxSnapshotInput) {
    return input.files.map((file) => ({ ...file }));
  }
}
