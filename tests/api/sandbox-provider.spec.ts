import { expect, test } from '@playwright/test';
import {
  PASSING_CART_TS,
  PASSING_CHECKOUT_TS,
  PASSING_PAYMENT_TS,
  createCandidateSessionFixture,
  uniqueTestEmail,
} from '../helpers/session-fixtures';
import { db } from '../../lib/db';
import { getSessionDiffEvidence } from '../../lib/diff/session-diff';
import { persistSandboxSnapshots } from '../../lib/sandbox/evidence';
import { ExternalSandboxProvider } from '../../lib/sandbox/external-provider';
import { LocalDevSandboxProvider } from '../../lib/sandbox/local-dev-provider';
import { getSandboxProvider } from '../../lib/sandbox/provider';
import { SimulatedSandboxProvider } from '../../lib/sandbox/simulated-provider';
import { createWorkspaceManifest } from '../../lib/sandbox/workspace-manifest';

const files = [
  { path: 'src/cart.ts', language: 'typescript', content: PASSING_CART_TS },
  { path: 'src/payment.ts', language: 'typescript', content: PASSING_PAYMENT_TS },
  { path: 'src/checkout.ts', language: 'typescript', content: PASSING_CHECKOUT_TS },
];
const workspaceManifest = createWorkspaceManifest(files);
const SHA_256_HEX = /^[a-f0-9]{64}$/;
const SANDBOX_RUN_ID = /^[a-z0-9-]+:[0-9a-f-]{36}$/;
const SIMULATED_CAPABILITIES = {
  readiness: 'demo_only',
  realCodeExecution: 'not_supported',
  productionIsolation: 'not_supported',
  commandPolicy: 'supported',
  networkPolicy: 'not_applicable',
  environmentPolicy: 'not_applicable',
  resourceLimits: 'not_applicable',
  workspaceSnapshots: 'supported',
  cleanupEvidence: 'not_applicable',
};
const LOCAL_DEV_CAPABILITIES = {
  readiness: 'local_dev_only',
  realCodeExecution: 'partial',
  productionIsolation: 'not_supported',
  commandPolicy: 'supported',
  networkPolicy: 'not_supported',
  environmentPolicy: 'supported',
  resourceLimits: 'partial',
  workspaceSnapshots: 'supported',
  cleanupEvidence: 'supported',
};
const EXTERNAL_UNCONFIGURED_CAPABILITIES = {
  readiness: 'adapter_unconfigured',
  realCodeExecution: 'not_supported',
  productionIsolation: 'not_supported',
  commandPolicy: 'not_supported',
  networkPolicy: 'not_supported',
  environmentPolicy: 'not_supported',
  resourceLimits: 'not_supported',
  workspaceSnapshots: 'not_supported',
  cleanupEvidence: 'not_supported',
};

test.describe('sandbox provider adapter', () => {
  test('creates a deterministic mounted workspace manifest for sandbox input evidence', () => {
    const manifest = createWorkspaceManifest(files);
    const reorderedManifest = createWorkspaceManifest([...files].reverse());
    const changedManifest = createWorkspaceManifest([
      ...files.slice(0, -1),
      { ...files[files.length - 1], content: `${files[files.length - 1].content}\n// changed` },
    ]);

    expect(manifest.workspaceFileCount).toBe(3);
    expect(manifest.workspaceTotalBytes).toBeGreaterThan(0);
    expect(manifest.workspaceDigest).toMatch(SHA_256_HEX);
    expect(manifest.workspaceDigest).toBe(reorderedManifest.workspaceDigest);
    expect(manifest.workspaceDigest).not.toBe(changedManifest.workspaceDigest);
    expect(manifest.workspaceFiles.map((file) => file.path)).toEqual(['src/cart.ts', 'src/checkout.ts', 'src/payment.ts']);
    expect(manifest.workspaceFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/cart.ts',
          language: 'typescript',
          contentLength: Buffer.byteLength(PASSING_CART_TS, 'utf8'),
          contentSha256: expect.stringMatching(SHA_256_HEX),
        }),
      ]),
    );
  });

  test('fails closed when sandbox input files do not match the mounted workspace manifest', async () => {
    const provider = new SimulatedSandboxProvider();
    const staleManifest = createWorkspaceManifest([
      ...files.slice(0, -1),
      { ...files[files.length - 1], content: `${files[files.length - 1].content}\n// stale manifest` },
    ]);

    const result = await provider.runCommand({
      sessionId: 'session_manifest_mismatch',
      command: 'npm test',
      files,
      workspaceManifest: staleManifest,
    });

    expect(result.status).toBe('failed');
    expect(result.exitCode).toBe(126);
    expect(result.output).toContain('Workspace manifest did not match mounted files.');
    expect(result.execution).toEqual(
      expect.objectContaining({
        sandboxRunId: expect.stringMatching(SANDBOX_RUN_ID),
        durationMs: 0,
        timedOut: false,
        cleanupStatus: 'not_applicable',
        skippedReason: 'workspace_manifest_mismatch',
      }),
    );
    expect(result.tests).toHaveLength(0);
    expect(result.snapshots).toHaveLength(0);
  });

  test('uses the simulated provider by default with provider metadata on command results', async () => {
    const originalProvider = process.env.SANDBOX_PROVIDER;
    delete process.env.SANDBOX_PROVIDER;

    try {
      const provider = getSandboxProvider();
      const result = await provider.runCommand({
        sessionId: 'session_adapter_test',
        command: 'npm test',
        files,
        workspaceManifest,
      });

      expect(provider).toBeInstanceOf(SimulatedSandboxProvider);
      expect(provider.id).toBe('simulated');
      expect(provider.kind).toBe('simulated');
      expect(provider.isTestCommand('npm test')).toBe(true);
      expect(result.provider.id).toBe('simulated');
      expect(result.provider.kind).toBe('simulated');
      expect(result.provider).toEqual(
        expect.objectContaining({
          executionMode: 'simulated',
          isolationLevel: 'none',
          networkAccess: 'none',
          networkPolicy: {
            mode: 'none',
            outboundAccess: 'none',
            allowedHosts: [],
            blockedByDefault: true,
          },
          capabilities: SIMULATED_CAPABILITIES,
          filesystemPersistence: 'virtual',
          cleanupPolicy: 'not_applicable',
          environmentPolicy: {
            mode: 'none',
            exposedEnvKeys: [],
            secretsExposed: false,
          },
          resourceLimits: {
            executionTimeoutMs: 10_000,
            outputLimitChars: 20_000,
            snapshotFileLimit: 200,
            snapshotContentLimit: 100_000,
            memoryLimitMb: null,
            cpuLimitMs: null,
          },
          commandPolicy: expect.objectContaining({
            mode: 'simulated_allowlist',
            allowedCommands: expect.arrayContaining(['npm test', 'ls', 'ls src', 'cat <path>', 'pwd']),
            blockedByDefault: true,
          }),
        }),
      );
      expect(result.execution).toEqual(
        expect.objectContaining({
          sandboxRunId: expect.stringMatching(SANDBOX_RUN_ID),
          durationMs: expect.any(Number),
          timedOut: false,
          cleanupStatus: 'not_applicable',
        }),
      );
      expect(result.status).toBe('succeeded');
      expect(result.tests).toHaveLength(4);
      expect(result.snapshots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'src/cart.ts',
            language: 'typescript',
            content: PASSING_CART_TS,
          }),
        ]),
      );
    } finally {
      if (originalProvider === undefined) delete process.env.SANDBOX_PROVIDER;
      else process.env.SANDBOX_PROVIDER = originalProvider;
    }
  });

  test('keeps local dev execution behind explicit sandbox provider config', () => {
    const originalProvider = process.env.SANDBOX_PROVIDER;
    const originalKeepWorkspace = process.env.SANDBOX_LOCAL_DEV_KEEP_WORKSPACE;
    process.env.SANDBOX_PROVIDER = 'local-dev';
    delete process.env.SANDBOX_LOCAL_DEV_KEEP_WORKSPACE;

    try {
      const provider = getSandboxProvider();

      expect(provider.id).toBe('local-dev');
      expect(provider.kind).toBe('local-dev');
      expect(provider.metadata()).toEqual(
        expect.objectContaining({
          executionMode: 'local_process',
          isolationLevel: 'host_temp_directory',
          networkAccess: 'host_inherited',
          networkPolicy: {
            mode: 'host_inherited',
            outboundAccess: 'host_inherited',
            allowedHosts: [],
            blockedByDefault: false,
          },
          capabilities: LOCAL_DEV_CAPABILITIES,
          filesystemPersistence: 'ephemeral_temp_directory',
          cleanupPolicy: 'delete_after_run',
          environmentPolicy: {
            mode: 'minimal_allowlist',
            exposedEnvKeys: ['NODE_ENV', 'PATH'],
            secretsExposed: false,
          },
          resourceLimits: {
            executionTimeoutMs: 10_000,
            outputLimitChars: 20_000,
            snapshotFileLimit: 200,
            snapshotContentLimit: 100_000,
            memoryLimitMb: null,
            cpuLimitMs: null,
          },
          commandPolicy: expect.objectContaining({
            mode: 'exact_allowlist',
            allowedCommands: ['npm test'],
            blockedByDefault: true,
          }),
        }),
      );
      expect(provider.isTestCommand('npm test')).toBe(true);
    } finally {
      if (originalProvider === undefined) delete process.env.SANDBOX_PROVIDER;
      else process.env.SANDBOX_PROVIDER = originalProvider;
      if (originalKeepWorkspace === undefined) delete process.env.SANDBOX_LOCAL_DEV_KEEP_WORKSPACE;
      else process.env.SANDBOX_LOCAL_DEV_KEEP_WORKSPACE = originalKeepWorkspace;
    }
  });

  test('returns local-dev disabled execution metadata without running commands implicitly', async () => {
    const originalProvider = process.env.SANDBOX_PROVIDER;
    const originalEnabled = process.env.SANDBOX_LOCAL_DEV_ENABLED;
    const originalKeepWorkspace = process.env.SANDBOX_LOCAL_DEV_KEEP_WORKSPACE;
    process.env.SANDBOX_PROVIDER = 'local-dev';
    delete process.env.SANDBOX_LOCAL_DEV_ENABLED;
    delete process.env.SANDBOX_LOCAL_DEV_KEEP_WORKSPACE;

    try {
      const provider = getSandboxProvider();
      const result = await provider.runCommand({
        sessionId: 'session_local_disabled',
        command: 'npm test',
        files,
        workspaceManifest,
      });

      expect(result.status).toBe('failed');
      expect(result.exitCode).toBe(126);
      expect(result.execution).toEqual(
        expect.objectContaining({
          sandboxRunId: expect.stringMatching(SANDBOX_RUN_ID),
          durationMs: 0,
          timedOut: false,
          cleanupStatus: 'not_applicable',
          skippedReason: expect.stringContaining('disabled'),
        }),
      );
      expect(result.provider).toEqual(
        expect.objectContaining({
          executionMode: 'local_process',
          isolationLevel: 'host_temp_directory',
          networkAccess: 'host_inherited',
          networkPolicy: {
            mode: 'host_inherited',
            outboundAccess: 'host_inherited',
            allowedHosts: [],
            blockedByDefault: false,
          },
          capabilities: LOCAL_DEV_CAPABILITIES,
          filesystemPersistence: 'ephemeral_temp_directory',
          cleanupPolicy: 'delete_after_run',
          environmentPolicy: {
            mode: 'minimal_allowlist',
            exposedEnvKeys: ['NODE_ENV', 'PATH'],
            secretsExposed: false,
          },
          resourceLimits: {
            executionTimeoutMs: 10_000,
            outputLimitChars: 20_000,
            snapshotFileLimit: 200,
            snapshotContentLimit: 100_000,
            memoryLimitMb: null,
            cpuLimitMs: null,
          },
          commandPolicy: expect.objectContaining({
            mode: 'exact_allowlist',
            allowedCommands: ['npm test'],
            blockedByDefault: true,
          }),
        }),
      );
      expect(result.snapshots).toHaveLength(0);
    } finally {
      if (originalProvider === undefined) delete process.env.SANDBOX_PROVIDER;
      else process.env.SANDBOX_PROVIDER = originalProvider;
      if (originalEnabled === undefined) delete process.env.SANDBOX_LOCAL_DEV_ENABLED;
      else process.env.SANDBOX_LOCAL_DEV_ENABLED = originalEnabled;
      if (originalKeepWorkspace === undefined) delete process.env.SANDBOX_LOCAL_DEV_KEEP_WORKSPACE;
      else process.env.SANDBOX_LOCAL_DEV_KEEP_WORKSPACE = originalKeepWorkspace;
    }
  });

  test('local-dev fails closed in production even when explicitly enabled', async () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    const originalNodeEnv = process.env.NODE_ENV;
    const originalEnabled = process.env.SANDBOX_LOCAL_DEV_ENABLED;
    mutableEnv.NODE_ENV = 'production';
    process.env.SANDBOX_LOCAL_DEV_ENABLED = 'true';

    try {
      const provider = new LocalDevSandboxProvider();
      const result = await provider.runCommand({
        sessionId: 'session_local_production_blocked',
        command: 'npm test',
        files,
        workspaceManifest,
      });

      expect(result.status).toBe('failed');
      expect(result.exitCode).toBe(126);
      expect(result.output).toContain('Local dev sandbox provider cannot execute commands in production.');
      expect(result.execution).toEqual(
        expect.objectContaining({
          durationMs: 0,
          timedOut: false,
          cleanupStatus: 'not_applicable',
          skippedReason: 'local_dev_production_blocked',
        }),
      );
      expect(result.provider.capabilities).toEqual(LOCAL_DEV_CAPABILITIES);
      expect(result.snapshots).toHaveLength(0);
    } finally {
      if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV;
      else mutableEnv.NODE_ENV = originalNodeEnv;
      if (originalEnabled === undefined) delete process.env.SANDBOX_LOCAL_DEV_ENABLED;
      else process.env.SANDBOX_LOCAL_DEV_ENABLED = originalEnabled;
    }
  });

  test('keeps external sandbox provider selection disabled until an adapter is configured', async () => {
    const originalProvider = process.env.SANDBOX_PROVIDER;
    const originalExternalProviderId = process.env.SANDBOX_EXTERNAL_PROVIDER_ID;
    process.env.SANDBOX_PROVIDER = 'external';
    process.env.SANDBOX_EXTERNAL_PROVIDER_ID = 'e2b';

    try {
      const provider = getSandboxProvider();
      const result = await provider.runCommand({
        sessionId: 'session_external_disabled',
        command: 'npm test',
        files,
        workspaceManifest,
      });

      expect(provider).toBeInstanceOf(ExternalSandboxProvider);
      expect(provider.id).toBe('e2b');
      expect(provider.kind).toBe('external');
      expect(provider.isTestCommand('npm test')).toBe(true);
      expect(provider.metadata()).toEqual(
        expect.objectContaining({
          id: 'e2b',
          kind: 'external',
          executionMode: 'not_executed',
          isolationLevel: 'none',
          networkAccess: 'none',
          networkPolicy: {
            mode: 'provider_managed',
            outboundAccess: 'none',
            allowedHosts: [],
            blockedByDefault: true,
          },
          capabilities: EXTERNAL_UNCONFIGURED_CAPABILITIES,
          filesystemPersistence: 'none',
          cleanupPolicy: 'not_applicable',
          environmentPolicy: {
            mode: 'provider_managed',
            exposedEnvKeys: [],
            secretsExposed: false,
          },
          resourceLimits: {
            executionTimeoutMs: 10_000,
            outputLimitChars: 20_000,
            snapshotFileLimit: 200,
            snapshotContentLimit: 100_000,
            memoryLimitMb: null,
            cpuLimitMs: null,
          },
          commandPolicy: expect.objectContaining({
            mode: 'provider_defined',
            allowedCommands: [],
            blockedByDefault: true,
          }),
        }),
      );
      expect(result.status).toBe('failed');
      expect(result.exitCode).toBe(126);
      expect(result.output).toContain('External sandbox provider e2b is selected but no adapter is configured.');
      expect(result.execution).toEqual(
        expect.objectContaining({
          sandboxRunId: expect.stringMatching(SANDBOX_RUN_ID),
          durationMs: 0,
          timedOut: false,
          cleanupStatus: 'not_applicable',
          skippedReason: 'external_provider_unconfigured',
        }),
      );
      expect(result.snapshots).toHaveLength(0);

      const aliasProvider = getSandboxProvider('daytona');
      expect(aliasProvider).toBeInstanceOf(ExternalSandboxProvider);
      expect(aliasProvider.id).toBe('daytona');
    } finally {
      if (originalProvider === undefined) delete process.env.SANDBOX_PROVIDER;
      else process.env.SANDBOX_PROVIDER = originalProvider;
      if (originalExternalProviderId === undefined) delete process.env.SANDBOX_EXTERNAL_PROVIDER_ID;
      else process.env.SANDBOX_EXTERNAL_PROVIDER_ID = originalExternalProviderId;
    }
  });

  test('local-dev records command policy blocks without running commands', async () => {
    const originalEnabled = process.env.SANDBOX_LOCAL_DEV_ENABLED;
    const originalAllowed = process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS;
    process.env.SANDBOX_LOCAL_DEV_ENABLED = 'true';
    process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS = 'npm test';

    try {
      const provider = new LocalDevSandboxProvider();
      const blockedFiles = [
        {
          path: 'spam.mjs',
          language: 'javascript',
          content: "console.log('should not run');",
        },
      ];
      const result = await provider.runCommand({
        sessionId: 'session_local_policy_block',
        command: 'node spam.mjs',
        files: blockedFiles,
        workspaceManifest: createWorkspaceManifest(blockedFiles),
      });

      expect(result.status).toBe('failed');
      expect(result.exitCode).toBe(126);
      expect(result.output).toContain('Command is not allowed for local dev sandbox execution.');
      expect(result.execution).toEqual(
        expect.objectContaining({
          durationMs: 0,
          timedOut: false,
          cleanupStatus: 'not_applicable',
          skippedReason: 'command_not_allowed',
        }),
      );
      expect(result.provider.commandPolicy).toEqual(
        expect.objectContaining({
          mode: 'exact_allowlist',
          allowedCommands: ['npm test'],
          blockedByDefault: true,
        }),
      );
      expect(result.provider.environmentPolicy).toEqual({
        mode: 'minimal_allowlist',
        exposedEnvKeys: ['NODE_ENV', 'PATH'],
        secretsExposed: false,
      });
      expect(result.provider.networkPolicy).toEqual({
        mode: 'host_inherited',
        outboundAccess: 'host_inherited',
        allowedHosts: [],
        blockedByDefault: false,
      });
      expect(result.provider.capabilities).toEqual(LOCAL_DEV_CAPABILITIES);
      expect(result.provider.resourceLimits).toEqual({
        executionTimeoutMs: 10_000,
        outputLimitChars: 20_000,
        snapshotFileLimit: 200,
        snapshotContentLimit: 100_000,
        memoryLimitMb: null,
        cpuLimitMs: null,
      });
      expect(result.snapshots).toHaveLength(0);
    } finally {
      if (originalEnabled === undefined) delete process.env.SANDBOX_LOCAL_DEV_ENABLED;
      else process.env.SANDBOX_LOCAL_DEV_ENABLED = originalEnabled;
      if (originalAllowed === undefined) delete process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS;
      else process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS = originalAllowed;
    }
  });

  test('local-dev reports configured resource limits for audit metadata', () => {
    const originalTimeout = process.env.SANDBOX_COMMAND_TIMEOUT_MS;
    const originalOutputLimit = process.env.SANDBOX_COMMAND_OUTPUT_LIMIT;
    const originalSnapshotFileLimit = process.env.SANDBOX_SNAPSHOT_FILE_LIMIT;
    const originalSnapshotContentLimit = process.env.SANDBOX_SNAPSHOT_CONTENT_LIMIT;
    process.env.SANDBOX_COMMAND_TIMEOUT_MS = '2500';
    process.env.SANDBOX_COMMAND_OUTPUT_LIMIT = '4096';
    process.env.SANDBOX_SNAPSHOT_FILE_LIMIT = '12';
    process.env.SANDBOX_SNAPSHOT_CONTENT_LIMIT = '8192';

    try {
      const provider = new LocalDevSandboxProvider();

      expect(provider.metadata().resourceLimits).toEqual({
        executionTimeoutMs: 2500,
        outputLimitChars: 4096,
        snapshotFileLimit: 12,
        snapshotContentLimit: 8192,
        memoryLimitMb: null,
        cpuLimitMs: null,
      });
    } finally {
      if (originalTimeout === undefined) delete process.env.SANDBOX_COMMAND_TIMEOUT_MS;
      else process.env.SANDBOX_COMMAND_TIMEOUT_MS = originalTimeout;
      if (originalOutputLimit === undefined) delete process.env.SANDBOX_COMMAND_OUTPUT_LIMIT;
      else process.env.SANDBOX_COMMAND_OUTPUT_LIMIT = originalOutputLimit;
      if (originalSnapshotFileLimit === undefined) delete process.env.SANDBOX_SNAPSHOT_FILE_LIMIT;
      else process.env.SANDBOX_SNAPSHOT_FILE_LIMIT = originalSnapshotFileLimit;
      if (originalSnapshotContentLimit === undefined) delete process.env.SANDBOX_SNAPSHOT_CONTENT_LIMIT;
      else process.env.SANDBOX_SNAPSHOT_CONTENT_LIMIT = originalSnapshotContentLimit;
    }
  });

  test('local-dev reports host-inherited network policy for audit metadata', () => {
    const provider = new LocalDevSandboxProvider();

    expect(provider.metadata().networkPolicy).toEqual({
      mode: 'host_inherited',
      outboundAccess: 'host_inherited',
      allowedHosts: [],
      blockedByDefault: false,
    });
  });

  test('local-dev exposes only the minimal runner environment to commands', async () => {
    const originalEnabled = process.env.SANDBOX_LOCAL_DEV_ENABLED;
    const originalAllowed = process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS;
    const originalSecret = process.env.HIREWAVE_SECRET_TEST;
    process.env.SANDBOX_LOCAL_DEV_ENABLED = 'true';
    process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS = 'node read-env.mjs';
    process.env.HIREWAVE_SECRET_TEST = 'server-secret-should-not-leak';

    try {
      const provider = new LocalDevSandboxProvider();
      const envFiles = [
        {
          path: 'read-env.mjs',
          language: 'javascript',
          content: [
            "console.log(process.env.HIREWAVE_SECRET_TEST || 'missing-secret');",
            "console.log(process.env.NODE_ENV || 'missing-node-env');",
            "console.log(process.env.PATH ? 'path-present' : 'path-missing');",
          ].join('\n'),
        },
      ];
      const result = await provider.runCommand({
        sessionId: 'session_local_env_policy',
        command: 'node read-env.mjs',
        files: envFiles,
        workspaceManifest: createWorkspaceManifest(envFiles),
      });

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('missing-secret');
      expect(result.output).toContain('test');
      expect(result.output).toContain('path-present');
      expect(result.output).not.toContain('server-secret-should-not-leak');
      expect(result.provider.environmentPolicy).toEqual({
        mode: 'minimal_allowlist',
        exposedEnvKeys: ['NODE_ENV', 'PATH'],
        secretsExposed: false,
      });
    } finally {
      if (originalEnabled === undefined) delete process.env.SANDBOX_LOCAL_DEV_ENABLED;
      else process.env.SANDBOX_LOCAL_DEV_ENABLED = originalEnabled;
      if (originalAllowed === undefined) delete process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS;
      else process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS = originalAllowed;
      if (originalSecret === undefined) delete process.env.HIREWAVE_SECRET_TEST;
      else process.env.HIREWAVE_SECRET_TEST = originalSecret;
    }
  });

  test('local-dev prepares the seeded checkout workspace so npm test can run without network setup', async () => {
    const originalEnabled = process.env.SANDBOX_LOCAL_DEV_ENABLED;
    const originalAllowed = process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS;
    const originalTimeout = process.env.SANDBOX_COMMAND_TIMEOUT_MS;
    process.env.SANDBOX_LOCAL_DEV_ENABLED = 'true';
    process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS = 'npm test';
    process.env.SANDBOX_COMMAND_TIMEOUT_MS = '15000';

    try {
      const provider = new LocalDevSandboxProvider();
      const result = await provider.runCommand({
        sessionId: 'session_local_checkout',
        command: 'npm test',
        files,
        workspaceManifest,
      });

      expect(result.status).toBe('succeeded');
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Local checkout test runner');
      expect(result.execution).toEqual(
        expect.objectContaining({
          cleanupStatus: 'deleted',
        }),
      );
      expect(result.tests).toHaveLength(4);
      expect(result.tests.every((testResult) => testResult.status === 'passed')).toBe(true);
      expect(result.snapshots.map((snapshot) => snapshot.path)).not.toContain('.hirewave/run-checkout-tests.mjs');
    } finally {
      if (originalEnabled === undefined) delete process.env.SANDBOX_LOCAL_DEV_ENABLED;
      else process.env.SANDBOX_LOCAL_DEV_ENABLED = originalEnabled;
      if (originalAllowed === undefined) delete process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS;
      else process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS = originalAllowed;
      if (originalTimeout === undefined) delete process.env.SANDBOX_COMMAND_TIMEOUT_MS;
      else process.env.SANDBOX_COMMAND_TIMEOUT_MS = originalTimeout;
    }
  });

  test('local-dev caps excessive command output and records truncation metadata', async () => {
    const originalEnabled = process.env.SANDBOX_LOCAL_DEV_ENABLED;
    const originalAllowed = process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS;
    const originalOutputLimit = process.env.SANDBOX_COMMAND_OUTPUT_LIMIT;
    process.env.SANDBOX_LOCAL_DEV_ENABLED = 'true';
    process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS = 'node spam.mjs';
    process.env.SANDBOX_COMMAND_OUTPUT_LIMIT = '80';

    try {
      const provider = new LocalDevSandboxProvider();
      const outputLimitFiles = [
        {
          path: 'spam.mjs',
          language: 'javascript',
          content: "console.log('x'.repeat(400));",
        },
      ];
      const result = await provider.runCommand({
        sessionId: 'session_local_output_limit',
        command: 'node spam.mjs',
        files: outputLimitFiles,
        workspaceManifest: createWorkspaceManifest(outputLimitFiles),
      });

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('[output truncated after 80 chars]');
      expect(result.output.length).toBeLessThan(140);
      expect(result.execution).toEqual(
        expect.objectContaining({
          outputTruncated: true,
          outputLimitChars: 80,
          outputChars: expect.any(Number),
        }),
      );
      expect(result.execution.outputChars).toBeGreaterThan(80);
    } finally {
      if (originalEnabled === undefined) delete process.env.SANDBOX_LOCAL_DEV_ENABLED;
      else process.env.SANDBOX_LOCAL_DEV_ENABLED = originalEnabled;
      if (originalAllowed === undefined) delete process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS;
      else process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS = originalAllowed;
      if (originalOutputLimit === undefined) delete process.env.SANDBOX_COMMAND_OUTPUT_LIMIT;
      else process.env.SANDBOX_COMMAND_OUTPUT_LIMIT = originalOutputLimit;
    }
  });

  test('local-dev labels command output chunks by system, stdout, and stderr streams', async () => {
    const originalEnabled = process.env.SANDBOX_LOCAL_DEV_ENABLED;
    const originalAllowed = process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS;
    process.env.SANDBOX_LOCAL_DEV_ENABLED = 'true';
    process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS = 'node streams.mjs';

    try {
      const provider = new LocalDevSandboxProvider();
      const streamFiles = [
        {
          path: 'streams.mjs',
          language: 'javascript',
          content: "console.log('from stdout'); console.error('from stderr');",
        },
      ];
      const result = await provider.runCommand({
        sessionId: 'session_local_streams',
        command: 'node streams.mjs',
        files: streamFiles,
        workspaceManifest: createWorkspaceManifest(streamFiles),
      });

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('from stdout');
      expect(result.output).toContain('from stderr');
      expect(result.outputChunks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ stream: 'system', content: expect.stringContaining('$ node streams.mjs') }),
          expect.objectContaining({ stream: 'stdout', content: expect.stringContaining('from stdout') }),
          expect.objectContaining({ stream: 'stderr', content: expect.stringContaining('from stderr') }),
        ]),
      );
    } finally {
      if (originalEnabled === undefined) delete process.env.SANDBOX_LOCAL_DEV_ENABLED;
      else process.env.SANDBOX_LOCAL_DEV_ENABLED = originalEnabled;
      if (originalAllowed === undefined) delete process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS;
      else process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS = originalAllowed;
    }
  });

  test('persists changed sandbox snapshots as runner-owned file evidence', async () => {
    const { session } = await createCandidateSessionFixture({
      name: 'Sandbox Snapshot Candidate',
      email: uniqueTestEmail('sandbox-snapshot'),
    });
    const starterSnapshots = await db.fileSnapshot.findMany({ where: { sessionId: session.id } });
    const starterCart = starterSnapshots.find((snapshot) => snapshot.path === 'src/cart.ts');
    const starterPayment = starterSnapshots.find((snapshot) => snapshot.path === 'src/payment.ts');
    if (!starterCart || !starterPayment) throw new Error('Expected starter checkout files');
    const updatedCart = `${starterCart.content}\n// normalized by sandbox command\n`;

    const persisted = await persistSandboxSnapshots({
      sessionId: session.id,
      commandRunId: 'cmd_snapshot_test',
      providerId: 'local-dev',
      providerKind: 'local-dev',
      snapshots: [
        { path: 'src/cart.ts', language: 'typescript', content: updatedCart },
        { path: 'src/payment.ts', language: starterPayment.language, content: starterPayment.content },
        { path: 'coverage/summary.txt', language: 'text', content: 'Statements: 100%' },
      ],
    });

    expect(persisted.map((snapshot) => snapshot.path).sort()).toEqual([
      'coverage/summary.txt',
      'src/cart.ts',
    ]);

    const savedSnapshots = await db.fileSnapshot.findMany({
      where: { sessionId: session.id, source: 'sandbox' },
      orderBy: { path: 'asc' },
    });
    expect(savedSnapshots.map((snapshot) => ({
      path: snapshot.path,
      version: snapshot.version,
      source: snapshot.source,
    }))).toEqual([
      { path: 'coverage/summary.txt', version: 1, source: 'sandbox' },
      { path: 'src/cart.ts', version: 2, source: 'sandbox' },
    ]);
    expect(savedSnapshots.find((snapshot) => snapshot.path === 'src/cart.ts')?.content).toBe(updatedCart);

    const snapshotEvent = await db.sessionEvent.findFirstOrThrow({
      where: { sessionId: session.id, type: 'sandbox_snapshot_saved' },
    });
    expect(JSON.parse(snapshotEvent.payloadJson)).toEqual(
      expect.objectContaining({
        commandRunId: 'cmd_snapshot_test',
        sandboxProviderId: 'local-dev',
        sandboxProviderKind: 'local-dev',
        savedSnapshotCount: 2,
      }),
    );

    const diffEvidence = await getSessionDiffEvidence(session.id);
    expect(diffEvidence.changedFiles.map((file) => file.path)).toEqual(
      expect.arrayContaining(['coverage/summary.txt', 'src/cart.ts']),
    );
    expect(diffEvidence.checkpoints.map((checkpoint) => checkpoint.type)).toContain('sandbox_snapshot_saved');
  });

  test('skips oversized sandbox snapshots and records skipped evidence', async () => {
    const originalContentLimit = process.env.SANDBOX_SNAPSHOT_CONTENT_LIMIT;
    process.env.SANDBOX_SNAPSHOT_CONTENT_LIMIT = '40';
    const { session } = await createCandidateSessionFixture({
      name: 'Sandbox Oversize Candidate',
      email: uniqueTestEmail('sandbox-oversize'),
    });

    try {
      const persisted = await persistSandboxSnapshots({
        sessionId: session.id,
        commandRunId: 'cmd_oversize_snapshot_test',
        providerId: 'local-dev',
        providerKind: 'local-dev',
        snapshots: [
          { path: 'coverage/small.txt', language: 'text', content: 'ok' },
          { path: 'coverage/large.txt', language: 'text', content: 'x'.repeat(120) },
        ],
      });

      expect(persisted.map((snapshot) => snapshot.path)).toEqual(['coverage/small.txt']);

      const savedLargeSnapshot = await db.fileSnapshot.findFirst({
        where: { sessionId: session.id, path: 'coverage/large.txt' },
      });
      expect(savedLargeSnapshot).toBeNull();

      const snapshotEvent = await db.sessionEvent.findFirstOrThrow({
        where: { sessionId: session.id, type: 'sandbox_snapshot_saved' },
      });
      expect(JSON.parse(snapshotEvent.payloadJson)).toEqual(
        expect.objectContaining({
          savedSnapshotCount: 1,
          skippedSnapshotCount: 1,
          skippedSnapshots: [
            expect.objectContaining({
              path: 'coverage/large.txt',
              reason: 'content_limit_exceeded',
              contentLength: 120,
              contentLimit: 40,
            }),
          ],
        }),
      );
    } finally {
      if (originalContentLimit === undefined) delete process.env.SANDBOX_SNAPSHOT_CONTENT_LIMIT;
      else process.env.SANDBOX_SNAPSHOT_CONTENT_LIMIT = originalContentLimit;
    }
  });

  test('skips unsafe sandbox snapshot paths and records skipped evidence', async () => {
    const { session } = await createCandidateSessionFixture({
      name: 'Sandbox Unsafe Path Candidate',
      email: uniqueTestEmail('sandbox-unsafe-path'),
    });

    const persisted = await persistSandboxSnapshots({
      sessionId: session.id,
      commandRunId: 'cmd_unsafe_snapshot_test',
      providerId: 'local-dev',
      providerKind: 'local-dev',
      snapshots: [
        { path: '../secret.txt', language: 'text', content: 'secret' },
        { path: '/absolute.txt', language: 'text', content: 'absolute' },
        { path: '.hirewave/internal.txt', language: 'text', content: 'internal' },
        { path: './coverage/safe.txt', language: 'text', content: 'safe' },
      ],
    });

    expect(persisted.map((snapshot) => snapshot.path)).toEqual(['coverage/safe.txt']);

    const savedSnapshots = await db.fileSnapshot.findMany({
      where: { sessionId: session.id, source: 'sandbox' },
      orderBy: { path: 'asc' },
    });
    expect(savedSnapshots.map((snapshot) => snapshot.path)).toEqual(['coverage/safe.txt']);

    const snapshotEvent = await db.sessionEvent.findFirstOrThrow({
      where: { sessionId: session.id, type: 'sandbox_snapshot_saved' },
    });
    expect(JSON.parse(snapshotEvent.payloadJson)).toEqual(
      expect.objectContaining({
        savedSnapshotCount: 1,
        skippedSnapshotCount: 3,
        skippedSnapshots: expect.arrayContaining([
          expect.objectContaining({ path: '../secret.txt', reason: 'unsafe_path' }),
          expect.objectContaining({ path: '/absolute.txt', reason: 'unsafe_path' }),
          expect.objectContaining({ path: '.hirewave/internal.txt', reason: 'unsafe_path' }),
        ]),
      }),
    );
  });
});
