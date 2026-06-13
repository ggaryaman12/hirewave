export type WorkspaceFile = {
  path: string;
  content: string;
  language: string;
};

export type SandboxWorkspaceManifestFile = {
  path: string;
  language: string;
  contentLength: number;
  contentSha256: string;
};

export type SandboxWorkspaceManifest = {
  workspaceFileCount: number;
  workspaceTotalBytes: number;
  workspaceDigest: string;
  workspaceFiles: SandboxWorkspaceManifestFile[];
};

export type SandboxProviderKind = 'simulated' | 'local-dev' | 'external';
export type SandboxExecutionMode = 'simulated' | 'local_process' | 'external_process' | 'not_executed';
export type SandboxIsolationLevel = 'none' | 'host_temp_directory' | 'isolated_container' | 'external_microvm';
export type SandboxNetworkAccess = 'none' | 'host_inherited' | 'disabled' | 'restricted' | 'unrestricted';
export type SandboxFilesystemPersistence = 'none' | 'virtual' | 'ephemeral_temp_directory' | 'provider_snapshot';
export type SandboxCleanupPolicy = 'not_applicable' | 'delete_after_run' | 'manual_retention' | 'provider_managed';
export type SandboxCommandPolicyMode = 'simulated_allowlist' | 'exact_allowlist' | 'provider_defined';
export type SandboxCleanupStatus = 'not_applicable' | 'deleted' | 'retained' | 'provider_managed' | 'failed';
export type SandboxEnvironmentPolicyMode = 'none' | 'minimal_allowlist' | 'provider_managed';
export type SandboxNetworkPolicyMode = 'none' | 'host_inherited' | 'deny_all' | 'allowlist' | 'provider_managed' | 'unrestricted';
export type SandboxReadinessStatus =
  | 'demo_only'
  | 'local_dev_only'
  | 'adapter_unconfigured'
  | 'configured_non_production'
  | 'production_ready'
  | 'unknown';
export type SandboxCapabilityStatus =
  | 'supported'
  | 'partial'
  | 'provider_managed'
  | 'not_supported'
  | 'not_applicable'
  | 'unknown';

export type SandboxProviderCapabilities = {
  readiness: SandboxReadinessStatus;
  realCodeExecution: SandboxCapabilityStatus;
  productionIsolation: SandboxCapabilityStatus;
  commandPolicy: SandboxCapabilityStatus;
  networkPolicy: SandboxCapabilityStatus;
  environmentPolicy: SandboxCapabilityStatus;
  resourceLimits: SandboxCapabilityStatus;
  workspaceSnapshots: SandboxCapabilityStatus;
  cleanupEvidence: SandboxCapabilityStatus;
};

export type SandboxCommandPolicy = {
  mode: SandboxCommandPolicyMode;
  allowedCommands: string[];
  blockedByDefault: boolean;
};

export type SandboxEnvironmentPolicy = {
  mode: SandboxEnvironmentPolicyMode;
  exposedEnvKeys: string[];
  secretsExposed: boolean;
};

export type SandboxNetworkPolicy = {
  mode: SandboxNetworkPolicyMode;
  outboundAccess: SandboxNetworkAccess;
  allowedHosts: string[];
  blockedByDefault: boolean;
};

export type SandboxResourceLimits = {
  executionTimeoutMs: number;
  outputLimitChars: number;
  snapshotFileLimit: number;
  snapshotContentLimit: number;
  memoryLimitMb: number | null;
  cpuLimitMs: number | null;
};

export type SandboxProviderMetadata = {
  id: string;
  kind: SandboxProviderKind;
  executionMode: SandboxExecutionMode;
  isolationLevel: SandboxIsolationLevel;
  networkAccess: SandboxNetworkAccess;
  networkPolicy: SandboxNetworkPolicy;
  capabilities: SandboxProviderCapabilities;
  filesystemPersistence: SandboxFilesystemPersistence;
  cleanupPolicy: SandboxCleanupPolicy;
  commandPolicy: SandboxCommandPolicy;
  environmentPolicy: SandboxEnvironmentPolicy;
  resourceLimits: SandboxResourceLimits;
};

export type SandboxTestResult = {
  name: string;
  status: 'passed' | 'failed';
  message: string;
  durationMs?: number;
};

export type SandboxOutputStream = 'system' | 'stdout' | 'stderr';

export type SandboxOutputChunk = {
  stream: SandboxOutputStream;
  content: string;
  truncated?: boolean;
};

export type SandboxExecutionMetadata = {
  sandboxRunId: string;
  durationMs: number;
  timedOut: boolean;
  cleanupStatus: SandboxCleanupStatus;
  cleanupError?: string;
  timeoutMs?: number;
  outputChars?: number;
  outputLimitChars?: number;
  outputTruncated?: boolean;
  skippedReason?: string;
};

export type SandboxCommandResult = {
  status: 'succeeded' | 'failed';
  exitCode: number;
  output: string;
  outputChunks: SandboxOutputChunk[];
  tests: SandboxTestResult[];
  provider: SandboxProviderMetadata;
  execution: SandboxExecutionMetadata;
  snapshots: WorkspaceFile[];
};

export type SandboxRunCommandInput = {
  sessionId: string;
  command: string;
  files: WorkspaceFile[];
  workspaceManifest: SandboxWorkspaceManifest;
};

export type SandboxSnapshotInput = {
  sessionId: string;
  files: WorkspaceFile[];
};

export interface SandboxProvider {
  id: string;
  kind: SandboxProviderKind;
  metadata(): SandboxProviderMetadata;
  isTestCommand(command: string): boolean;
  runCommand(input: SandboxRunCommandInput): Promise<SandboxCommandResult>;
  snapshot(input: SandboxSnapshotInput): Promise<WorkspaceFile[]>;
}
