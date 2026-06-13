import crypto from 'crypto';

export function createSandboxRunId(providerId: string) {
  return `${providerId}:${crypto.randomUUID()}`;
}
