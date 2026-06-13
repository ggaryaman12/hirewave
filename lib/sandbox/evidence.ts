import { db } from '@/lib/db';
import { logSessionEvent } from '@/lib/telemetry';
import { validateWorkspacePath } from '@/lib/workspace-paths';
import { getSandboxResourceLimits } from './resource-limits';
import type { SandboxProviderKind, WorkspaceFile } from './types';

type PersistSandboxSnapshotsInput = {
  sessionId: string;
  commandRunId: string;
  providerId: string;
  providerKind: SandboxProviderKind;
  snapshots: WorkspaceFile[];
};

type SkippedSnapshotReason = 'content_limit_exceeded' | 'file_limit_exceeded' | 'unsafe_path';

function snapshotSummary(snapshot: WorkspaceFile & { version: number }) {
  return {
    path: snapshot.path,
    language: snapshot.language,
    version: snapshot.version,
    contentLength: snapshot.content.length,
  };
}

function skippedSnapshot(input: {
  snapshot: WorkspaceFile;
  reason: SkippedSnapshotReason;
  contentLimit: number;
  fileLimit: number;
}) {
  return {
    path: input.snapshot.path,
    language: input.snapshot.language,
    reason: input.reason,
    contentLength: input.snapshot.content.length,
    contentLimit: input.contentLimit,
    fileLimit: input.fileLimit,
  };
}

export async function persistSandboxSnapshots(input: PersistSandboxSnapshotsInput) {
  if (!input.snapshots.length) return [];

  const resourceLimits = getSandboxResourceLimits();
  const contentLimit = resourceLimits.snapshotContentLimit;
  const fileLimit = resourceLimits.snapshotFileLimit;

  const existingSnapshots = await db.fileSnapshot.findMany({
    where: { sessionId: input.sessionId },
    orderBy: [{ path: 'asc' }, { version: 'asc' }],
  });
  const latestByPath = new Map<string, (typeof existingSnapshots)[number]>();
  for (const snapshot of existingSnapshots) {
    latestByPath.set(snapshot.path, snapshot);
  }

  const persisted: Array<WorkspaceFile & { version: number }> = [];
  const skipped: ReturnType<typeof skippedSnapshot>[] = [];
  for (const snapshot of input.snapshots) {
    const workspacePath = validateWorkspacePath(snapshot.path);
    if (!workspacePath.ok) {
      skipped.push(skippedSnapshot({
        snapshot,
        reason: 'unsafe_path',
        contentLimit,
        fileLimit,
      }));
      continue;
    }

    const safeSnapshot = { ...snapshot, path: workspacePath.path };
    const latest = latestByPath.get(safeSnapshot.path);
    if (latest?.content === safeSnapshot.content && latest.language === safeSnapshot.language) continue;

    if (safeSnapshot.content.length > contentLimit) {
      skipped.push(skippedSnapshot({
        snapshot: safeSnapshot,
        reason: 'content_limit_exceeded',
        contentLimit,
        fileLimit,
      }));
      continue;
    }

    if (persisted.length >= fileLimit) {
      skipped.push(skippedSnapshot({
        snapshot: safeSnapshot,
        reason: 'file_limit_exceeded',
        contentLimit,
        fileLimit,
      }));
      continue;
    }

    const saved = await db.fileSnapshot.create({
      data: {
        sessionId: input.sessionId,
        path: safeSnapshot.path,
        content: safeSnapshot.content,
        language: safeSnapshot.language,
        version: (latest?.version || 0) + 1,
        source: 'sandbox',
      },
    });

    latestByPath.set(safeSnapshot.path, saved);
    persisted.push(saved);
  }

  if (!persisted.length && !skipped.length) return [];

  await logSessionEvent({
    sessionId: input.sessionId,
    type: 'sandbox_snapshot_saved',
    actor: 'runner',
    payload: {
      commandRunId: input.commandRunId,
      sandboxProviderId: input.providerId,
      sandboxProviderKind: input.providerKind,
      savedSnapshotCount: persisted.length,
      skippedSnapshotCount: skipped.length,
      snapshots: persisted.map(snapshotSummary),
      skippedSnapshots: skipped,
    },
  });

  return persisted;
}
