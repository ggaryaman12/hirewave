import type {
  SandboxCommandResult,
  SandboxOutputChunk,
  SandboxProvider,
  SandboxProviderMetadata,
  SandboxRunCommandInput,
  SandboxSnapshotInput,
  WorkspaceFile,
} from './types';
import { isSimulatedTestCommand } from './simulated-provider';
import { createSandboxRunId } from './run-id';
import { getSandboxResourceLimits } from './resource-limits';
import { validateWorkspaceManifest } from './workspace-manifest';

function configuredProviderId(providerId?: string) {
  return providerId || process.env.SANDBOX_EXTERNAL_PROVIDER_ID?.trim() || 'external-unconfigured';
}

function metadata(providerId?: string): SandboxProviderMetadata {
  return {
    id: configuredProviderId(providerId),
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
    capabilities: {
      readiness: 'adapter_unconfigured',
      realCodeExecution: 'not_supported',
      productionIsolation: 'not_supported',
      commandPolicy: 'not_supported',
      networkPolicy: 'not_supported',
      environmentPolicy: 'not_supported',
      resourceLimits: 'not_supported',
      workspaceSnapshots: 'not_supported',
      cleanupEvidence: 'not_supported',
    },
    filesystemPersistence: 'none',
    cleanupPolicy: 'not_applicable',
    environmentPolicy: {
      mode: 'provider_managed',
      exposedEnvKeys: [],
      secretsExposed: false,
    },
    resourceLimits: getSandboxResourceLimits(),
    commandPolicy: {
      mode: 'provider_defined',
      allowedCommands: [],
      blockedByDefault: true,
    },
  };
}

export class ExternalSandboxProvider implements SandboxProvider {
  readonly id: string;
  readonly kind = 'external';

  constructor(providerId?: string) {
    this.id = configuredProviderId(providerId);
  }

  metadata() {
    return metadata(this.id);
  }

  isTestCommand(command: string) {
    return isSimulatedTestCommand(command);
  }

  async runCommand(input: SandboxRunCommandInput): Promise<SandboxCommandResult> {
    const sandboxRunId = createSandboxRunId(this.id);
    const manifestValidation = validateWorkspaceManifest(input.files, input.workspaceManifest);
    if (!manifestValidation.ok) {
      const outputChunks: SandboxOutputChunk[] = [
        { stream: 'system', content: `$ ${input.command}\n` },
        { stream: 'stderr', content: 'Workspace manifest did not match mounted files.' },
      ];
      const output = outputChunks.map((chunk) => chunk.content).join('').trimEnd();

      return {
        status: 'failed',
        exitCode: 126,
        output,
        outputChunks,
        tests: [],
        provider: this.metadata(),
        execution: {
          sandboxRunId,
          durationMs: 0,
          timedOut: false,
          cleanupStatus: 'not_applicable',
          outputChars: output.length,
          outputTruncated: false,
          skippedReason: 'workspace_manifest_mismatch',
        },
        snapshots: [],
      };
    }

    const outputChunks: SandboxOutputChunk[] = [
      { stream: 'system', content: `$ ${input.command}\n` },
      {
        stream: 'stderr',
        content: [
          `External sandbox provider ${this.id} is selected but no adapter is configured.`,
          'Configure a concrete sandbox adapter before using external execution for assessments.',
        ].join('\n'),
      },
    ];
    const output = outputChunks.map((chunk) => chunk.content).join('').trimEnd();

    return {
      status: 'failed',
      exitCode: 126,
      output,
      outputChunks,
      tests: [],
      provider: this.metadata(),
      execution: {
        sandboxRunId,
        durationMs: 0,
        timedOut: false,
        cleanupStatus: 'not_applicable',
        outputChars: output.length,
        outputTruncated: false,
        skippedReason: 'external_provider_unconfigured',
      },
      snapshots: [],
    };
  }

  async snapshot(_input: SandboxSnapshotInput): Promise<WorkspaceFile[]> {
    return [];
  }
}
