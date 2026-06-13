import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProductShell } from '@/components/product/app-shell';
import { ReportDetailTabs, type ReportDetailTabsData } from '@/components/product/report-detail-tabs';
import { requireHiringUser } from '@/lib/auth/demo-auth';
import { formatTokenUsage, readTokenUsage, type TokenUsage } from '@/lib/ai/token-usage';
import { db } from '@/lib/db';
import { getSessionDiffEvidence } from '@/lib/diff/session-diff';
import { parseJson } from '@/lib/json';

type ReportJson = {
  rubricVersion?: string;
  modelMetadata?: {
    evaluator?: {
      provider?: string;
      model?: string;
      generatedAt?: string;
    };
    sandbox?: {
      providerIds?: string[];
      providerKinds?: string[];
      executionModes?: string[];
      sandboxRunIds?: string[];
      readinessStatuses?: string[];
      capabilityStatuses?: Record<string, string[]>;
      capabilityGaps?: string[];
      productionReadyCommandCount?: number;
      nonProductionReadyCommandCount?: number;
      isolationLevels?: string[];
      networkAccessModes?: string[];
      networkPolicyModes?: string[];
      networkOutboundAccessModes?: string[];
      networkAllowedHosts?: string[];
      networkNotBlockedByDefaultCommandCount?: number;
      networkUnrestrictedCommandCount?: number;
      filesystemPersistenceModes?: string[];
      cleanupPolicies?: string[];
      cleanupStatuses?: string[];
      environmentPolicyModes?: string[];
      exposedEnvKeys?: string[];
      secretsExposedCommandCount?: number;
      executionTimeoutMsMax?: number | null;
      outputLimitCharsMax?: number | null;
      snapshotFileLimitMax?: number | null;
      snapshotContentLimitMax?: number | null;
      memoryLimitMbMax?: number | null;
      cpuLimitMsMax?: number | null;
      commandPolicyModes?: string[];
      commandPolicyBlockedCommandCount?: number;
      commandRunsWithMetadata?: number;
      snapshotCount?: number;
      persistedSnapshotCount?: number;
      skippedSnapshotCount?: number;
      cleanupFailedCommandCount?: number;
      cleanupRetainedCommandCount?: number;
      timedOutCommandCount?: number;
      outputTruncatedCommandCount?: number;
      outputChunkCount?: number;
      outputStreamKinds?: string[];
      workspaceFileCountMax?: number;
      workspaceTotalBytesMax?: number;
      workspaceFilePaths?: string[];
      workspaceDigests?: string[];
      workspaceManifestMismatchCommandCount?: number;
      providerErrorCommandCount?: number;
      invalidWorkspaceFileCommandCount?: number;
      externalProviderUnconfiguredCommandCount?: number;
      totalOutputChars?: number;
      totalDurationMs?: number;
    };
  };
  overallRecommendation: string;
  overallScore: number;
  summary: string;
  dimensionScores: {
    dimension: string;
    score: number;
    evidence: string[];
    strengths: string[];
    concerns: string[];
    followUpQuestions: string[];
  }[];
  scoreBreakdown?: {
    dimension: string;
    score: number;
    evidenceSummary?: string;
    concernSummary?: string;
    rationale?: string;
  }[];
  areasForGrowth?: { title: string; detail: string }[];
  keyMoments?: {
    type: string;
    title: string;
    occurredAt: string;
    summary: string;
    severity?: string;
  }[];
  activityBreakdown?: { category: string; count: number; seconds: number; minutes: number }[];
  promptComplexity?: { occurredAt: string; score: number; excerpt: string }[];
  narrativePhases?: {
    title: string;
    timeRange?: string | null;
    timestamp?: string | null;
    summary: string;
    evidenceItems: string[];
  }[];
  timelineSummary: string;
  codeQualitySummary: string;
  aiUsageSummary: string;
  sandboxSummary?: string;
  tokenUsageSummary?: {
    promptCount: number;
    responseCount: number;
    usefulResponses: number;
    guardrailResponses: number;
    fallbackResponses: number;
    providerTokenResponses: number;
    estimatedTokenResponses: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  aiCaveats?: string[];
  riskFlags: string[];
  nextInterviewFocus: string[];
  diffSummary?: {
    changedFileCount: number;
    totalAdditions: number;
    totalDeletions: number;
    changedFiles: { path: string; additions: number; deletions: number }[];
    checkpoints: { type: string; summary: string; occurredAt: string }[];
  };
};

export default async function ReportPage({ params }: { params: { sessionId: string } }) {
  const { workspace } = await requireHiringUser(`/dashboard/reports/${params.sessionId}`);
  const session = await db.candidateSession.findFirst({
    where: {
      id: params.sessionId,
      assessment: { workspaceId: workspace.id },
    },
    include: {
      candidate: true,
      assessment: true,
      fileSnapshots: { orderBy: [{ path: 'asc' }, { version: 'asc' }] },
      aiMessages: { orderBy: { createdAt: 'asc' } },
      commandRuns: { orderBy: { startedAt: 'asc' }, include: { testResults: true } },
      events: { orderBy: { occurredAt: 'asc' } },
      evaluationReport: true,
    },
  });

  if (!session || !session.evaluationReport) {
    return (
      <ProductShell title="Report not ready">
        <p className="text-sm text-black/60">No completed evaluation report was found for this session.</p>
      </ProductShell>
    );
  }

  const report = normalizeReportJson(
    objectValue(parseJson<unknown>(session.evaluationReport.reportJson, {})),
    {
      overallRecommendation: session.evaluationReport.overallRecommendation,
      overallScore: session.evaluationReport.overallScore,
      summary: session.evaluationReport.summary,
    },
  );
  const diffEvidence = await getSessionDiffEvidence(session.id);

  const finalFiles = Array.from(
    session.fileSnapshots.reduce((map, snapshot) => map.set(snapshot.path, snapshot), new Map<string, (typeof session.fileSnapshots)[number]>()),
  )
    .map(([, snapshot]) => snapshot)
    .sort((a, b) => a.path.localeCompare(b.path));

  const auditRows = buildAuditRows(report, session.evaluationReport.generatedBy, session.evaluationReport.createdAt.toISOString());
  const commandMetadataByRunId = new Map<string, Record<string, unknown>>();
  for (const event of session.events) {
    if (!['command_finished', 'test_run_finished'].includes(event.type)) continue;
    const payload = parseJson<Record<string, unknown>>(event.payloadJson, {});
    if (typeof payload.commandRunId === 'string') {
      commandMetadataByRunId.set(payload.commandRunId, payload);
    }
  }
  const reportTabsData: ReportDetailTabsData = {
    candidate: {
      name: session.candidate.name,
      email: session.candidate.email,
      assessmentTitle: session.assessment.title,
    },
    report: {
      rubricVersion: report.rubricVersion,
      overallRecommendation: report.overallRecommendation,
      overallScore: report.overallScore,
      summary: report.summary,
      timelineSummary: report.timelineSummary || 'No timeline summary was captured.',
      codeQualitySummary: report.codeQualitySummary || 'No code quality summary was captured.',
      aiUsageSummary: report.aiUsageSummary || 'No AI usage summary was captured.',
      sandboxSummary: report.sandboxSummary || 'No sandbox provider metadata was captured.',
      dimensionScores: report.dimensionScores || [],
      scoreBreakdown: report.scoreBreakdown || [],
      areasForGrowth: report.areasForGrowth || [],
      keyMoments: report.keyMoments || [],
      activityBreakdown: report.activityBreakdown || [],
      promptComplexity: report.promptComplexity || [],
      narrativePhases: report.narrativePhases || [],
      riskFlags: report.riskFlags || [],
      nextInterviewFocus: report.nextInterviewFocus || [],
      tokenUsageSummary: report.tokenUsageSummary,
      aiCaveats: report.aiCaveats || [],
    },
    auditRows,
    aiMessages: session.aiMessages.map((message) => {
      const tokenUsage = getAiMessageTokenUsage(message.metadataJson);

      return {
        id: message.id,
        role: message.role,
        content: message.content,
        tokenUsageLabel: tokenUsage
          ? `Tokens: ${formatTokenUsage(tokenUsage)} · input ${tokenUsage.promptTokens.toLocaleString()} · output ${tokenUsage.completionTokens.toLocaleString()}`
          : null,
      };
    }),
    commandRuns: session.commandRuns.map((run) => ({
      id: run.id,
      command: run.command,
      output: run.output,
      exitCode: run.exitCode,
      sandbox: commandSandboxMetadata(commandMetadataByRunId.get(run.id)),
    })),
    diffEvidence,
    finalFiles: finalFiles.map((file) => ({
      id: file.id,
      path: file.path,
      content: file.content,
    })),
    exportUrls: {
      markdown: `/api/reports/${session.id}/export?format=markdown`,
      json: `/api/reports/${session.id}/export?format=json`,
    },
  };

  return (
    <ProductShell
      title={`${session.candidate.name} report`}
      subtitle={`${session.assessment.title} · ${session.candidate.email}`}
      action={
        <Link
          href={`/dashboard/assessments/${session.assessmentId}`}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-black/10 bg-white/60 px-3 text-sm font-bold text-black/70 hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Assessment
        </Link>
      }
    >
      <ReportDetailTabs data={reportTabsData} />
    </ProductShell>
  );
}

function commandSandboxMetadata(payload: Record<string, unknown> | undefined) {
  if (!payload) return undefined;

  return {
    providerId: stringValue(payload.sandboxProviderId),
    readiness: stringValue(payload.sandboxReadinessStatus),
    executionMode: stringValue(payload.sandboxExecutionMode),
    isolationLevel: stringValue(payload.sandboxIsolationLevel),
    sandboxRunId: stringValue(payload.sandboxRunId),
    cleanupStatus: stringValue(payload.cleanupStatus),
    skippedReason: stringValue(payload.skippedReason) || undefined,
    outputTruncated: payload.outputTruncated === true,
  };
}

function getAiMessageTokenUsage(metadataJson: string | null): TokenUsage | null {
  const metadata = parseJson<{ usage?: unknown }>(metadataJson, {});
  return readTokenUsage(metadata.usage);
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizedDimensionScores(value: unknown): ReportJson['dimensionScores'] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const dimension = stringValue((item as { dimension?: unknown }).dimension);
    if (!dimension) return [];

    return [{
      dimension,
      score: numberValue((item as { score?: unknown }).score),
      evidence: stringArrayValue((item as { evidence?: unknown }).evidence),
      strengths: stringArrayValue((item as { strengths?: unknown }).strengths),
      concerns: stringArrayValue((item as { concerns?: unknown }).concerns),
      followUpQuestions: stringArrayValue((item as { followUpQuestions?: unknown }).followUpQuestions),
    }];
  });
}

function normalizedScoreBreakdown(value: unknown): NonNullable<ReportJson['scoreBreakdown']> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const dimension = stringValue((item as { dimension?: unknown }).dimension);
    if (!dimension) return [];

    return [{
      dimension,
      score: numberValue((item as { score?: unknown }).score),
      evidenceSummary: stringValue((item as { evidenceSummary?: unknown }).evidenceSummary),
      concernSummary: stringValue((item as { concernSummary?: unknown }).concernSummary),
      rationale: stringValue((item as { rationale?: unknown }).rationale),
    }];
  });
}

function normalizedGrowthAreas(value: unknown): NonNullable<ReportJson['areasForGrowth']> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const title = stringValue((item as { title?: unknown }).title);
    const detail = stringValue((item as { detail?: unknown }).detail);
    return title || detail ? [{ title: title || 'Growth area', detail }] : [];
  });
}

function normalizedKeyMoments(value: unknown): NonNullable<ReportJson['keyMoments']> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const type = stringValue((item as { type?: unknown }).type);
    const occurredAt = stringValue((item as { occurredAt?: unknown }).occurredAt);
    if (!type || !occurredAt) return [];

    return [{
      type,
      occurredAt,
      title: stringValue((item as { title?: unknown }).title, type.replaceAll('_', ' ')),
      summary: stringValue((item as { summary?: unknown }).summary),
      severity: stringValue((item as { severity?: unknown }).severity) || undefined,
    }];
  });
}

function normalizedActivityBreakdown(value: unknown): NonNullable<ReportJson['activityBreakdown']> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const category = stringValue((item as { category?: unknown }).category);
    if (!category) return [];

    return [{
      category,
      count: numberValue((item as { count?: unknown }).count),
      seconds: numberValue((item as { seconds?: unknown }).seconds),
      minutes: numberValue((item as { minutes?: unknown }).minutes),
    }];
  });
}

function normalizedPromptComplexity(value: unknown): NonNullable<ReportJson['promptComplexity']> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const occurredAt = stringValue((item as { occurredAt?: unknown }).occurredAt);
    if (!occurredAt) return [];

    return [{
      occurredAt,
      score: numberValue((item as { score?: unknown }).score),
      excerpt: stringValue((item as { excerpt?: unknown }).excerpt),
    }];
  });
}

function normalizedNarrativePhases(value: unknown): NonNullable<ReportJson['narrativePhases']> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const title = stringValue((item as { title?: unknown }).title);
    if (!title) return [];

    return [{
      title,
      timeRange: stringValue((item as { timeRange?: unknown }).timeRange) || null,
      timestamp: stringValue((item as { timestamp?: unknown }).timestamp) || null,
      summary: stringValue((item as { summary?: unknown }).summary),
      evidenceItems: stringArrayValue((item as { evidenceItems?: unknown }).evidenceItems),
    }];
  });
}

function normalizedTokenUsageSummary(value: unknown): ReportJson['tokenUsageSummary'] {
  if (!value || typeof value !== 'object') return undefined;
  const summary = value as Record<string, unknown>;

  return {
    promptCount: numberValue(summary.promptCount),
    responseCount: numberValue(summary.responseCount),
    usefulResponses: numberValue(summary.usefulResponses),
    guardrailResponses: numberValue(summary.guardrailResponses),
    fallbackResponses: numberValue(summary.fallbackResponses),
    providerTokenResponses: numberValue(summary.providerTokenResponses),
    estimatedTokenResponses: numberValue(summary.estimatedTokenResponses),
    promptTokens: numberValue(summary.promptTokens),
    completionTokens: numberValue(summary.completionTokens),
    totalTokens: numberValue(summary.totalTokens),
  };
}

function normalizeReportJson(
  parsed: Partial<ReportJson>,
  fallback: Pick<ReportJson, 'overallRecommendation' | 'overallScore' | 'summary'>,
): ReportJson {
  return {
    ...parsed,
    rubricVersion: stringValue(parsed.rubricVersion) || undefined,
    overallRecommendation: stringValue(parsed.overallRecommendation) || fallback.overallRecommendation,
    overallScore: numberValue(parsed.overallScore, fallback.overallScore),
    summary: stringValue(parsed.summary) || fallback.summary,
    dimensionScores: normalizedDimensionScores(parsed.dimensionScores),
    scoreBreakdown: normalizedScoreBreakdown(parsed.scoreBreakdown),
    areasForGrowth: normalizedGrowthAreas(parsed.areasForGrowth),
    keyMoments: normalizedKeyMoments(parsed.keyMoments),
    activityBreakdown: normalizedActivityBreakdown(parsed.activityBreakdown),
    promptComplexity: normalizedPromptComplexity(parsed.promptComplexity),
    narrativePhases: normalizedNarrativePhases(parsed.narrativePhases),
    timelineSummary: stringValue(parsed.timelineSummary),
    codeQualitySummary: stringValue(parsed.codeQualitySummary),
    aiUsageSummary: stringValue(parsed.aiUsageSummary),
    sandboxSummary: stringValue(parsed.sandboxSummary) || undefined,
    tokenUsageSummary: normalizedTokenUsageSummary(parsed.tokenUsageSummary),
    aiCaveats: stringArrayValue(parsed.aiCaveats),
    riskFlags: stringArrayValue(parsed.riskFlags),
    nextInterviewFocus: stringArrayValue(parsed.nextInterviewFocus),
  };
}

function joinStringArray(value: unknown, fallback: string) {
  const items = stringArrayValue(value);
  return items.length ? items.join(', ') : fallback;
}

function objectValue(value: unknown): Partial<ReportJson> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<ReportJson> : {};
}

function buildAuditRows(report: ReportJson, generatedBy: string, createdAt: string) {
  const sandbox = report.modelMetadata?.sandbox;

  return [
    { label: 'Rubric version', value: stringValue(report.rubricVersion, 'unknown') },
    { label: 'Evaluator provider', value: stringValue(report.modelMetadata?.evaluator?.provider, generatedBy) },
    { label: 'Evaluator model', value: stringValue(report.modelMetadata?.evaluator?.model, generatedBy) },
    { label: 'Generated at', value: formatDateTime(stringValue(report.modelMetadata?.evaluator?.generatedAt, createdAt)) },
    { label: 'Sandbox provider', value: joinStringArray(sandbox?.providerIds, 'unknown') },
    { label: 'Sandbox execution', value: joinStringArray(sandbox?.executionModes, 'unknown') },
    { label: 'Sandbox run IDs', value: joinStringArray(sandbox?.sandboxRunIds, 'unknown') },
    { label: 'Sandbox readiness', value: joinStringArray(sandbox?.readinessStatuses, 'unknown') },
    { label: 'Production-ready runs', value: String(sandbox?.productionReadyCommandCount || 0) },
    { label: 'Non-production-ready runs', value: String(sandbox?.nonProductionReadyCommandCount || 0) },
    { label: 'Capability gaps', value: joinStringArray(sandbox?.capabilityGaps, 'none') },
    { label: 'Sandbox isolation', value: joinStringArray(sandbox?.isolationLevels, 'unknown') },
    { label: 'Sandbox network', value: joinStringArray(sandbox?.networkAccessModes, 'unknown') },
    { label: 'Network policy', value: joinStringArray(sandbox?.networkPolicyModes, 'unknown') },
    { label: 'Outbound network', value: joinStringArray(sandbox?.networkOutboundAccessModes, 'unknown') },
    { label: 'Allowed network hosts', value: joinStringArray(sandbox?.networkAllowedHosts, 'none') },
    { label: 'Network not blocked by default', value: String(sandbox?.networkNotBlockedByDefaultCommandCount || 0) },
    { label: 'Unrestricted network runs', value: String(sandbox?.networkUnrestrictedCommandCount || 0) },
    { label: 'Sandbox filesystem', value: joinStringArray(sandbox?.filesystemPersistenceModes, 'unknown') },
    { label: 'Sandbox cleanup', value: joinStringArray(sandbox?.cleanupPolicies, 'unknown') },
    { label: 'Cleanup status', value: joinStringArray(sandbox?.cleanupStatuses, 'unknown') },
    { label: 'Environment policy', value: joinStringArray(sandbox?.environmentPolicyModes, 'unknown') },
    { label: 'Exposed env keys', value: joinStringArray(sandbox?.exposedEnvKeys, 'none') },
    { label: 'Secret-exposing commands', value: String(sandbox?.secretsExposedCommandCount || 0) },
    { label: 'Max command timeout', value: `${sandbox?.executionTimeoutMsMax || 0}ms` },
    { label: 'Max output limit', value: `${sandbox?.outputLimitCharsMax || 0} chars` },
    { label: 'Max snapshot files', value: String(sandbox?.snapshotFileLimitMax || 0) },
    { label: 'Max snapshot bytes', value: String(sandbox?.snapshotContentLimitMax || 0) },
    { label: 'Max memory limit', value: sandbox?.memoryLimitMbMax ? `${sandbox.memoryLimitMbMax} MB` : 'not enforced' },
    { label: 'Max CPU limit', value: sandbox?.cpuLimitMsMax ? `${sandbox.cpuLimitMsMax}ms` : 'not enforced' },
    { label: 'Command policy', value: joinStringArray(sandbox?.commandPolicyModes, 'unknown') },
    { label: 'Policy-blocked commands', value: String(sandbox?.commandPolicyBlockedCommandCount || 0) },
    { label: 'Sandbox snapshots', value: String(sandbox?.snapshotCount || 0) },
    { label: 'Persisted sandbox snapshots', value: String(sandbox?.persistedSnapshotCount || 0) },
    { label: 'Skipped sandbox snapshots', value: String(sandbox?.skippedSnapshotCount || 0) },
    { label: 'Sandbox runtime', value: `${sandbox?.totalDurationMs || 0}ms` },
    { label: 'Sandbox output', value: `${sandbox?.totalOutputChars || 0} chars` },
    { label: 'Output chunks', value: String(sandbox?.outputChunkCount || 0) },
    { label: 'Output streams', value: joinStringArray(sandbox?.outputStreamKinds, 'unknown') },
    { label: 'Mounted workspace files', value: String(sandbox?.workspaceFileCountMax || 0) },
    { label: 'Mounted workspace bytes', value: String(sandbox?.workspaceTotalBytesMax || 0) },
    { label: 'Mounted workspace paths', value: joinStringArray(sandbox?.workspaceFilePaths, 'unknown') },
    { label: 'Mounted workspace digests', value: joinStringArray(sandbox?.workspaceDigests, 'unknown') },
    { label: 'Workspace manifest mismatches', value: String(sandbox?.workspaceManifestMismatchCommandCount || 0) },
    { label: 'Cleanup failures', value: String(sandbox?.cleanupFailedCommandCount || 0) },
    { label: 'Retained workspaces', value: String(sandbox?.cleanupRetainedCommandCount || 0) },
    { label: 'Truncated outputs', value: String(sandbox?.outputTruncatedCommandCount || 0) },
    { label: 'Sandbox timeouts', value: String(sandbox?.timedOutCommandCount || 0) },
    { label: 'Provider errors', value: String(sandbox?.providerErrorCommandCount || 0) },
    { label: 'Unconfigured external sandbox', value: String(sandbox?.externalProviderUnconfiguredCommandCount || 0) },
    { label: 'Invalid workspace inputs', value: String(sandbox?.invalidWorkspaceFileCommandCount || 0) },
  ];
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
