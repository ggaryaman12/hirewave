import { db } from '@/lib/db';
import { readTokenUsage } from '@/lib/ai/token-usage';
import { parseJson } from '@/lib/json';
import { tokenHash } from '@/lib/tokens';
import { logSessionEvent } from '@/lib/telemetry';
import { validateWorkspacePath } from '@/lib/workspace-paths';

export async function getSessionByToken(sessionToken: string) {
  return db.candidateSession.findUnique({
    where: { sessionTokenHash: tokenHash(sessionToken) },
    include: {
      candidate: true,
      assessment: {
        include: {
          challenge: {
            include: { files: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      },
      fileSnapshots: { orderBy: [{ path: 'asc' }, { version: 'asc' }] },
      aiMessages: { orderBy: { createdAt: 'asc' } },
      commandRuns: { orderBy: { startedAt: 'asc' }, include: { testResults: true } },
      events: { orderBy: { occurredAt: 'asc' } },
      evaluationReport: true,
    },
  });
}

export async function getLatestFiles(sessionId: string) {
  const snapshots = await db.fileSnapshot.findMany({
    where: { sessionId },
    orderBy: [{ path: 'asc' }, { version: 'asc' }],
  });

  const latest = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) {
    latest.set(snapshot.path, snapshot);
  }

  return Array.from(latest.values()).sort((a, b) => a.path.localeCompare(b.path));
}

export async function initializeSessionFiles(input: { sessionId: string; challengeId: string }) {
  const files = await db.challengeFile.findMany({
    where: { challengeId: input.challengeId },
    orderBy: { sortOrder: 'asc' },
  });

  await db.fileSnapshot.createMany({
    data: files.map((file) => ({
      sessionId: input.sessionId,
      path: file.path,
      content: file.content,
      language: file.language,
      version: 1,
      source: 'starter',
    })),
  });
}

export async function saveSessionFile(input: {
  sessionId: string;
  path: string;
  content: string;
  language?: string;
}) {
  const workspacePath = validateWorkspacePath(input.path);
  if (!workspacePath.ok) {
    throw new Error(`Unsafe workspace file path: ${workspacePath.reason}`);
  }

  const latest = await db.fileSnapshot.findFirst({
    where: { sessionId: input.sessionId, path: workspacePath.path },
    orderBy: { version: 'desc' },
  });

  if (latest?.content === input.content) return latest;

  const snapshot = await db.fileSnapshot.create({
    data: {
      sessionId: input.sessionId,
      path: workspacePath.path,
      content: input.content,
      language: input.language || latest?.language || 'text',
      version: (latest?.version || 0) + 1,
      source: 'candidate',
    },
  });

  await logSessionEvent({
    sessionId: input.sessionId,
    type: 'file_changed',
    actor: 'candidate',
    payload: {
      path: workspacePath.path,
      version: snapshot.version,
      contentLength: input.content.length,
    },
  });

  await logSessionEvent({
    sessionId: input.sessionId,
    type: 'file_saved',
    actor: 'candidate',
    payload: {
      path: workspacePath.path,
      version: snapshot.version,
    },
  });

  return snapshot;
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function outputChunksFromPayload(payload: Record<string, unknown> | undefined) {
  if (!payload || !Array.isArray(payload.outputChunks)) return undefined;

  const chunks = payload.outputChunks.flatMap((chunk) => {
    if (!chunk || typeof chunk !== 'object') return [];
    const candidate = chunk as { stream?: unknown; content?: unknown; truncated?: unknown };
    if (candidate.stream !== 'system' && candidate.stream !== 'stdout' && candidate.stream !== 'stderr') return [];
    if (typeof candidate.content !== 'string') return [];

    return [{
      stream: candidate.stream,
      content: candidate.content,
      truncated: candidate.truncated === true,
    }];
  });

  return chunks.length ? chunks : undefined;
}

function commandSandboxMetadata(payload: Record<string, unknown> | undefined) {
  if (!payload || typeof payload.sandboxProviderId !== 'string') return undefined;

  return {
    providerId: stringValue(payload.sandboxProviderId),
    providerKind: stringValue(payload.sandboxProviderKind),
    executionMode: stringValue(payload.sandboxExecutionMode),
    isolationLevel: stringValue(payload.sandboxIsolationLevel),
    networkAccess: stringValue(payload.sandboxNetworkAccess),
    networkPolicy: {
      mode: stringValue(payload.sandboxNetworkPolicyMode),
      outboundAccess: stringValue(payload.sandboxNetworkOutboundAccess),
      allowedHosts: stringArrayValue(payload.sandboxNetworkAllowedHosts),
      blockedByDefault: payload.sandboxNetworkBlockedByDefault === true,
    },
    capabilities: {
      readiness: stringValue(payload.sandboxReadinessStatus),
      ...recordValue(payload.sandboxCapabilityStatuses),
    },
    filesystemPersistence: stringValue(payload.sandboxFilesystemPersistence),
    cleanupPolicy: stringValue(payload.sandboxCleanupPolicy),
    commandPolicy: {
      mode: stringValue(payload.sandboxCommandPolicyMode),
      allowedCommands: stringArrayValue(payload.sandboxAllowedCommands),
      blockedByDefault: payload.sandboxBlockedByDefault === true,
    },
    snapshotCount: numberValue(payload.snapshotCount),
    persistedSnapshotCount: numberValue(payload.persistedSnapshotCount),
    execution: {
      sandboxRunId: stringValue(payload.sandboxRunId),
      durationMs: numberValue(payload.durationMs),
      timedOut: payload.timedOut === true,
      cleanupStatus: stringValue(payload.cleanupStatus),
      cleanupError: stringValue(payload.cleanupError) || undefined,
      timeoutMs: numberValue(payload.timeoutMs),
      outputChars: numberValue(payload.outputChars),
      outputLimitChars: numberValue(payload.outputLimitChars),
      outputTruncated: payload.outputTruncated === true,
      skippedReason: stringValue(payload.skippedReason) || undefined,
    },
  };
}

export function serializeSession(session: NonNullable<Awaited<ReturnType<typeof getSessionByToken>>>) {
  const latest = new Map<string, { path: string; language: string; content: string; version: number }>();
  for (const snapshot of session.fileSnapshots) {
    latest.set(snapshot.path, {
      path: snapshot.path,
      language: snapshot.language,
      content: snapshot.content,
      version: snapshot.version,
    });
  }

  const commandMetadataByRunId = new Map<string, Record<string, unknown>>();
  for (const event of session.events) {
    if (!['command_output', 'command_finished', 'test_run_finished'].includes(event.type)) continue;
    const payload = parseJson<Record<string, unknown>>(event.payloadJson, {});
    if (typeof payload.commandRunId !== 'string') continue;
    commandMetadataByRunId.set(payload.commandRunId, {
      ...(commandMetadataByRunId.get(payload.commandRunId) || {}),
      ...payload,
    });
  }

  return {
    id: session.id,
    status: session.status,
    startedAt: session.startedAt?.toISOString() || null,
    submittedAt: session.submittedAt?.toISOString() || null,
    expiresAt: session.expiresAt.toISOString(),
    candidate: {
      name: session.candidate.name,
      email: session.candidate.email,
    },
    assessment: {
      id: session.assessment.id,
      title: session.assessment.title,
      role: session.assessment.role,
      seniority: session.assessment.seniority,
      durationMinutes: session.assessment.durationMinutes,
      aiMode: session.assessment.aiMode,
      allowedTools: parseJson<string[]>(session.assessment.allowedToolsJson, []),
    },
    challenge: {
      title: session.assessment.challenge.title,
      scenario: session.assessment.challenge.scenario,
      instructions: session.assessment.challenge.instructions,
      stack: parseJson<string[]>(session.assessment.challenge.stackJson, []),
    },
    starterFiles: session.assessment.challenge.files.map((file) => ({
      path: file.path,
      language: file.language,
      content: file.content,
    })),
    files: Array.from(latest.values()).sort((a, b) => a.path.localeCompare(b.path)),
    aiMessages: session.aiMessages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      tokenUsage: readTokenUsage(parseJson<{ usage?: unknown }>(message.metadataJson || '{}', {}).usage),
    })),
    commandRuns: session.commandRuns.map((run) => {
      const metadata = commandMetadataByRunId.get(run.id);

      return {
        id: run.id,
        command: run.command,
        status: run.status,
        output: run.output,
        outputChunks: outputChunksFromPayload(metadata),
        exitCode: run.exitCode,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() || null,
        sandbox: commandSandboxMetadata(metadata),
        testResults: run.testResults.map((test) => ({
          id: test.id,
          name: test.name,
          status: test.status,
          message: test.message,
        })),
      };
    }),
    events: session.events.map((event) => ({
      id: event.id,
      type: event.type,
      actor: event.actor,
      payload: parseJson<Record<string, unknown>>(event.payloadJson, {}),
      occurredAt: event.occurredAt.toISOString(),
    })),
    reportId: session.evaluationReport?.id || null,
  };
}
