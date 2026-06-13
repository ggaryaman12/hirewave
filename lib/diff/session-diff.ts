import { db } from '@/lib/db';
import { buildFileDiff, type FileDiff } from '@/lib/diff/text-diff';
import { parseJson } from '@/lib/json';

export type DiffCheckpoint = {
  id: string;
  type: string;
  label: string;
  summary: string;
  occurredAt: string;
  filePath?: string;
  version?: number;
  additions?: number;
  deletions?: number;
};

export type SessionDiffEvidence = {
  files: FileDiff[];
  changedFiles: FileDiff[];
  checkpoints: DiffCheckpoint[];
  summary: {
    changedFileCount: number;
    totalAdditions: number;
    totalDeletions: number;
    checkpointCount: number;
  };
};

type SessionWithDiffData = NonNullable<Awaited<ReturnType<typeof loadSessionDiffData>>>;
type FileSnapshot = SessionWithDiffData['fileSnapshots'][number];

async function loadSessionDiffData(sessionId: string) {
  return db.candidateSession.findUnique({
    where: { id: sessionId },
    include: {
      assessment: {
        include: {
          challenge: {
            include: { files: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      },
      fileSnapshots: { orderBy: [{ path: 'asc' }, { version: 'asc' }] },
      events: { orderBy: { occurredAt: 'asc' } },
    },
  });
}

function latestSnapshots(snapshots: FileSnapshot[]) {
  const latest = new Map<string, FileSnapshot>();
  for (const snapshot of snapshots) {
    latest.set(snapshot.path, snapshot);
  }
  return latest;
}

function snapshotByPathVersion(snapshots: FileSnapshot[]) {
  const map = new Map<string, FileSnapshot>();
  for (const snapshot of snapshots) {
    map.set(`${snapshot.path}:${snapshot.version}`, snapshot);
  }
  return map;
}

function checkpointLabel(type: string) {
  switch (type) {
    case 'session_started':
      return 'Session started';
    case 'file_saved':
      return 'File saved';
    case 'sandbox_snapshot_saved':
      return 'Sandbox snapshot saved';
    case 'test_run_finished':
      return 'Test run finished';
    case 'ai_response_received':
      return 'AI response received';
    case 'session_ended':
      return 'Submitted';
    default:
      return type.replaceAll('_', ' ');
  }
}

function buildCheckpoint(input: {
  event: SessionWithDiffData['events'][number];
  snapshotsByVersion: Map<string, FileSnapshot>;
}) {
  const payload = parseJson<Record<string, unknown>>(input.event.payloadJson, {});

  if (input.event.type === 'file_saved') {
    const path = typeof payload.path === 'string' ? payload.path : '';
    const version = typeof payload.version === 'number' ? payload.version : Number(payload.version || 0);
    const snapshot = input.snapshotsByVersion.get(`${path}:${version}`);
    const previous = input.snapshotsByVersion.get(`${path}:${version - 1}`);
    const diff = snapshot
      ? buildFileDiff({
          path,
          language: snapshot.language,
          originalContent: previous?.content || '',
          currentContent: snapshot.content,
        })
      : null;

    return {
      id: input.event.id,
      type: input.event.type,
      label: checkpointLabel(input.event.type),
      summary: diff
        ? `Saved ${path} (+${diff.additions}/-${diff.deletions})`
        : `Saved ${path || 'a file'}`,
      occurredAt: input.event.occurredAt.toISOString(),
      filePath: path || undefined,
      version: version || undefined,
      additions: diff?.additions,
      deletions: diff?.deletions,
    };
  }

  if (input.event.type === 'test_run_finished') {
    const passed = Number(payload.passed || 0);
    const total = Number(payload.total || 0);
    const failed = Number(payload.failed || 0);
    return {
      id: input.event.id,
      type: input.event.type,
      label: checkpointLabel(input.event.type),
      summary: total ? `${passed}/${total} tests passed${failed ? `, ${failed} failed` : ''}` : 'Test run finished',
      occurredAt: input.event.occurredAt.toISOString(),
    };
  }

  if (input.event.type === 'sandbox_snapshot_saved') {
    const savedSnapshotCount = Number(payload.savedSnapshotCount || 0);
    const snapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];
    const paths = snapshots
      .map((snapshot) => (
        snapshot && typeof snapshot === 'object' && 'path' in snapshot ? String(snapshot.path) : ''
      ))
      .filter(Boolean);

    return {
      id: input.event.id,
      type: input.event.type,
      label: checkpointLabel(input.event.type),
      summary: savedSnapshotCount
        ? `Sandbox persisted ${savedSnapshotCount} file snapshot${savedSnapshotCount === 1 ? '' : 's'}${paths.length ? `: ${paths.join(', ')}` : ''}`
        : 'Sandbox snapshot captured no file changes',
      occurredAt: input.event.occurredAt.toISOString(),
    };
  }

  if (input.event.type === 'ai_response_received') {
    const responseLength = Number(payload.responseLength || 0);
    const provider = typeof payload.provider === 'string' ? payload.provider : '';
    const safetyFlags = Array.isArray(payload.safetyFlags) ? payload.safetyFlags : [];
    const isGuardrail =
      provider === 'guardrail' ||
      safetyFlags.includes('low_signal_prompt') ||
      safetyFlags.includes('assistant_capability_boundary');
    const isFallback = provider === 'fallback' || safetyFlags.includes('provider_error');
    const label = isGuardrail ? 'AI clarification' : isFallback ? 'AI fallback' : checkpointLabel(input.event.type);
    const summaryPrefix = isGuardrail
      ? 'Clarification guardrail response captured'
      : isFallback
        ? 'Provider fallback response captured'
        : 'AI response captured';

    return {
      id: input.event.id,
      type: input.event.type,
      label,
      summary: responseLength ? `${summaryPrefix} (${responseLength} chars)` : summaryPrefix,
      occurredAt: input.event.occurredAt.toISOString(),
    };
  }

  if (input.event.type === 'session_started') {
    return {
      id: input.event.id,
      type: input.event.type,
      label: checkpointLabel(input.event.type),
      summary: 'Candidate entered the assessment room',
      occurredAt: input.event.occurredAt.toISOString(),
    };
  }

  return {
    id: input.event.id,
    type: input.event.type,
    label: checkpointLabel(input.event.type),
    summary: 'Candidate submitted the assessment',
    occurredAt: input.event.occurredAt.toISOString(),
  };
}

export async function getSessionDiffEvidence(sessionId: string): Promise<SessionDiffEvidence> {
  const session = await loadSessionDiffData(sessionId);
  if (!session) throw new Error('Session not found');

  const latest = latestSnapshots(session.fileSnapshots);
  const allPaths = Array.from(new Set([
    ...session.assessment.challenge.files.map((file) => file.path),
    ...session.fileSnapshots.map((snapshot) => snapshot.path),
  ])).sort((a, b) => a.localeCompare(b));

  const files = allPaths.map((path) => {
    const starter = session.assessment.challenge.files.find((file) => file.path === path);
    const current = latest.get(path);

    return buildFileDiff({
      path,
      language: current?.language || starter?.language || 'text',
      originalContent: starter?.content || '',
      currentContent: current?.content || '',
    });
  });

  const changedFiles = files.filter((file) => file.changed);
  const importantTypes = new Set([
    'session_started',
    'file_saved',
    'sandbox_snapshot_saved',
    'test_run_finished',
    'ai_response_received',
    'session_ended',
  ]);
  const snapshotsByVersion = snapshotByPathVersion(session.fileSnapshots);
  const checkpoints = session.events
    .filter((event) => importantTypes.has(event.type))
    .map((event) => buildCheckpoint({ event, snapshotsByVersion }));

  return {
    files,
    changedFiles,
    checkpoints,
    summary: {
      changedFileCount: changedFiles.length,
      totalAdditions: changedFiles.reduce((sum, file) => sum + file.additions, 0),
      totalDeletions: changedFiles.reduce((sum, file) => sum + file.deletions, 0),
      checkpointCount: checkpoints.length,
    },
  };
}
