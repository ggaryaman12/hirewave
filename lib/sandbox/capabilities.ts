import type { SandboxCapabilityStatus, SandboxProviderCapabilities } from './types';

export const SANDBOX_CAPABILITY_KEYS = [
  'realCodeExecution',
  'productionIsolation',
  'commandPolicy',
  'networkPolicy',
  'environmentPolicy',
  'resourceLimits',
  'workspaceSnapshots',
  'cleanupEvidence',
] as const;

export type SandboxCapabilityKey = (typeof SANDBOX_CAPABILITY_KEYS)[number];
export type SandboxCapabilityStatuses = Record<SandboxCapabilityKey, SandboxCapabilityStatus>;

export function sandboxCapabilityStatuses(capabilities: SandboxProviderCapabilities): SandboxCapabilityStatuses {
  return SANDBOX_CAPABILITY_KEYS.reduce((statuses, key) => {
    statuses[key] = capabilities[key];
    return statuses;
  }, {} as SandboxCapabilityStatuses);
}

export function sandboxCapabilityGaps(statuses: Partial<Record<SandboxCapabilityKey, unknown>>) {
  return SANDBOX_CAPABILITY_KEYS.filter((key) => {
    const status = statuses[key];
    return status === 'not_supported' || status === 'partial' || status === 'unknown';
  }).sort((a, b) => a.localeCompare(b));
}
