import { ExternalSandboxProvider } from './external-provider';
import { LocalDevSandboxProvider } from './local-dev-provider';
import { SimulatedSandboxProvider } from './simulated-provider';
import type { SandboxProvider } from './types';

export type SandboxProviderName = 'simulated' | 'local-dev' | 'external' | 'e2b' | 'daytona' | 'codesandbox';

export function getSandboxProvider(name = process.env.SANDBOX_PROVIDER || 'simulated'): SandboxProvider {
  const normalized = name.trim().toLowerCase();

  if (normalized === 'simulated') return new SimulatedSandboxProvider();
  if (normalized === 'local-dev') return new LocalDevSandboxProvider();
  if (normalized === 'external') return new ExternalSandboxProvider();
  if (['e2b', 'daytona', 'codesandbox'].includes(normalized)) return new ExternalSandboxProvider(normalized);

  throw new Error(`Unsupported SANDBOX_PROVIDER: ${name}`);
}
