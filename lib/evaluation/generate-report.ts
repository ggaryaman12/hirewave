import { db } from '@/lib/db';
import { generateAgentDelegationReport } from '@/lib/evaluation/generate-agent-report';
import { getSessionDiffEvidence } from '@/lib/diff/session-diff';
import { readTokenUsage } from '@/lib/ai/token-usage';
import { parseJson, toJson } from '@/lib/json';
import { SANDBOX_CAPABILITY_KEYS, sandboxCapabilityGaps } from '@/lib/sandbox/capabilities';
import { getLatestFiles } from '@/lib/sessions';

type DimensionReport = {
  dimension: string;
  score: number;
  evidence: string[];
  strengths: string[];
  concerns: string[];
  followUpQuestions: string[];
};

const RUBRIC_VERSION = 'ai-collaboration-v1';
const EVALUATOR_PROVIDER = 'deterministic';
const EVALUATOR_MODEL = 'deterministic-evidence-ai-collaboration-v1';

const DIMENSIONS = [
  'Problem Decomposition',
  'First-Principles Thinking',
  'Creative Problem Solving',
  'Iteration Quality',
  'Debugging with AI',
  'Architecture Decisions',
  'Communication Clarity',
  'Token Efficiency',
];

function scoreFromEvidence(base: number, cap = 5) {
  return Math.max(1, Math.min(cap, base));
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return count === 1 ? singular : pluralLabel;
}

function workspaceFilePath(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const path = (value as { path?: unknown }).path;
  return typeof path === 'string' ? path : null;
}

function compactText(value: string, maxLength = 180) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function isoDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function promptComplexityScore(content: string) {
  const normalized = content.toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  const technicalSignals = [
    'test',
    'debug',
    'failing',
    'error',
    'root',
    'cause',
    'checkout',
    'validation',
    'rollback',
    'idempotency',
    'typescript',
    'api',
  ];
  const specificSignals = technicalSignals.filter((signal) => normalized.includes(signal)).length;
  const questionSignals = ['how', 'why', 'where', 'approach', 'fix', 'verify'].filter((signal) =>
    normalized.includes(signal),
  ).length;
  const broadAskPenalty = /^(help|fix this|what now|i am stuck|stuck)\??$/.test(normalized.trim()) ? 1 : 0;

  return Math.max(
    1,
    Math.min(5, 1 + Math.min(2, specificSignals) + (words.length >= 8 ? 1 : 0) + (questionSignals ? 1 : 0) - broadAskPenalty),
  );
}

function parseAiMetadata(metadataJson: string | null) {
  return parseJson<{
    provider?: string;
    usage?: unknown;
    safetyFlags?: string[];
  }>(metadataJson, {});
}

function isGuardrailAiResponse(metadata: ReturnType<typeof parseAiMetadata>) {
  const safetyFlags = Array.isArray(metadata.safetyFlags) ? metadata.safetyFlags : [];
  return (
    metadata.provider === 'guardrail' ||
    safetyFlags.includes('low_signal_prompt') ||
    safetyFlags.includes('assistant_capability_boundary')
  );
}

function isFallbackAiResponse(metadata: ReturnType<typeof parseAiMetadata>) {
  const safetyFlags = Array.isArray(metadata.safetyFlags) ? metadata.safetyFlags : [];
  return metadata.provider === 'fallback' || safetyFlags.includes('provider_error');
}

function summarizeAiUsage(input: {
  aiMessages: { role: string; metadataJson: string | null }[];
  aiPromptEventCount: number;
}) {
  const userMessageCount = input.aiMessages.filter((message) => message.role === 'user').length;
  const assistantMessages = input.aiMessages.filter((message) => message.role === 'assistant');
  const summary = {
    promptCount: Math.max(input.aiPromptEventCount, userMessageCount),
    responseCount: assistantMessages.length,
    usefulResponses: 0,
    guardrailResponses: 0,
    fallbackResponses: 0,
    providerTokenResponses: 0,
    estimatedTokenResponses: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  for (const message of assistantMessages) {
    const metadata = parseAiMetadata(message.metadataJson);
    const usage = readTokenUsage(metadata.usage);

    if (isFallbackAiResponse(metadata)) {
      summary.fallbackResponses += 1;
    } else if (isGuardrailAiResponse(metadata)) {
      summary.guardrailResponses += 1;
    } else {
      summary.usefulResponses += 1;
    }

    if (usage) {
      summary.promptTokens += usage.promptTokens;
      summary.completionTokens += usage.completionTokens;
      summary.totalTokens += usage.totalTokens;
      if (usage.tokenSource === 'provider') summary.providerTokenResponses += 1;
      else summary.estimatedTokenResponses += 1;
    }
  }

  const aiCaveats = [
    ...(summary.guardrailResponses
      ? [`${summary.guardrailResponses} clarification guardrail ${plural(summary.guardrailResponses, 'response')} occurred.`]
      : []),
    ...(summary.fallbackResponses
      ? [
          `${summary.fallbackResponses} provider fallback ${plural(summary.fallbackResponses, 'response')} occurred; treat that as platform reliability context, not candidate failure.`,
        ]
      : []),
  ];

  return {
    ...summary,
    responseMixEvidence: `${summary.usefulResponses} useful AI ${plural(summary.usefulResponses, 'response')}, ${summary.guardrailResponses} clarification ${plural(summary.guardrailResponses, 'guardrail')}, ${summary.fallbackResponses} provider ${plural(summary.fallbackResponses, 'fallback')}`,
    aiCaveats,
  };
}

export async function generateEvaluationReport(sessionId: string) {
  const routing = await db.candidateSession.findUnique({
    where: { id: sessionId },
    select: { assessment: { select: { aiMode: true } } },
  });

  // Agent-mode assessments are scored with the ai-delegation-v1 rubric.
  if (routing?.assessment.aiMode === 'agent') {
    return generateAgentDelegationReport(sessionId);
  }

  const session = await db.candidateSession.findUnique({
    where: { id: sessionId },
    include: {
      candidate: true,
      assessment: { include: { challenge: true } },
      events: { orderBy: { occurredAt: 'asc' } },
      aiMessages: { orderBy: { createdAt: 'asc' } },
      commandRuns: { orderBy: { startedAt: 'asc' }, include: { testResults: true } },
    },
  });

  if (!session) throw new Error('Session not found');

  const files = await getLatestFiles(session.id);
  const diffEvidence = await getSessionDiffEvidence(session.id);
  const events = session.events.map((event) => ({
    ...event,
    payload: parseJson<Record<string, unknown>>(event.payloadJson, {}),
  }));

  const fileChangeCount = events.filter((event) => event.type === 'file_changed').length;
  const aiPromptCount = events.filter((event) => event.type === 'ai_prompt_sent').length;
  const aiStats = summarizeAiUsage({
    aiMessages: session.aiMessages,
    aiPromptEventCount: aiPromptCount,
  });
  const aiOverdelegationPromptCount = session.aiMessages.filter((message) => {
    if (message.role !== 'user') return false;
    const content = message.content.toLowerCase();
    return /\b(can|could|will|would|please|pls)\s+you\b[\s\S]*\b(fix|implement|change|modify|make|solve|do)\b[\s\S]*\b(for me|my code|the code|entire|all of)/.test(content) ||
      /\b(fix|implement|solve|do)\s+(all|everything|entire|this)\b/.test(content) ||
      /\bcheck\b[\s\S]*\b(entire|whole|all)\b[\s\S]*\b(code|codebase|workspace)\b/.test(content);
  }).length;
  const sandboxFinishedEvents = events.filter(
    (event) =>
      ['command_finished', 'test_run_finished'].includes(event.type) &&
      typeof event.payload.sandboxProviderId === 'string',
  );
  const sandboxSnapshotEvents = events.filter((event) => event.type === 'sandbox_snapshot_saved');
  const sandboxProviderIds = Array.from(
    new Set(sandboxFinishedEvents.map((event) => String(event.payload.sandboxProviderId))),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxProviderKinds = Array.from(
    new Set(sandboxFinishedEvents.map((event) => String(event.payload.sandboxProviderKind || 'unknown'))),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxExecutionModes = Array.from(
    new Set(sandboxFinishedEvents.map((event) => String(event.payload.sandboxExecutionMode || 'unknown'))),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxRunIds = Array.from(
    new Set(
      sandboxFinishedEvents.flatMap((event) =>
        typeof event.payload.sandboxRunId === 'string' ? [event.payload.sandboxRunId] : [],
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxReadinessStatuses = Array.from(
    new Set(sandboxFinishedEvents.map((event) => String(event.payload.sandboxReadinessStatus || 'unknown'))),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxCapabilityStatusFromEvent = (event: (typeof sandboxFinishedEvents)[number], key: string) => {
    const statuses = event.payload.sandboxCapabilityStatuses;
    if (!statuses || typeof statuses !== 'object') return 'unknown';
    const value = (statuses as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : 'unknown';
  };
  const sandboxCapabilityStatuses = Object.fromEntries(
    SANDBOX_CAPABILITY_KEYS.map((key) => [
      key,
      Array.from(new Set(sandboxFinishedEvents.map((event) => sandboxCapabilityStatusFromEvent(event, key))))
        .sort((a, b) => a.localeCompare(b)),
    ]),
  );
  const sandboxCapabilityGapList = Array.from(
    new Set(
      sandboxFinishedEvents.flatMap((event) => {
        if (Array.isArray(event.payload.sandboxCapabilityGaps)) {
          return event.payload.sandboxCapabilityGaps.map((gap) => String(gap));
        }

        return sandboxCapabilityGaps(
          Object.fromEntries(
            SANDBOX_CAPABILITY_KEYS.map((key) => [key, sandboxCapabilityStatusFromEvent(event, key)]),
          ),
        );
      }),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxProductionReadyCommandCount = sandboxFinishedEvents.filter(
    (event) => event.payload.sandboxReadinessStatus === 'production_ready',
  ).length;
  const sandboxNonProductionReadyCommandCount = Math.max(
    0,
    sandboxFinishedEvents.length - sandboxProductionReadyCommandCount,
  );
  const sandboxIsolationLevels = Array.from(
    new Set(sandboxFinishedEvents.map((event) => String(event.payload.sandboxIsolationLevel || 'unknown'))),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxNotProductionIsolated =
    sandboxIsolationLevels.includes('none') || sandboxIsolationLevels.includes('host_temp_directory');
  const sandboxNetworkAccessModes = Array.from(
    new Set(sandboxFinishedEvents.map((event) => String(event.payload.sandboxNetworkAccess || 'unknown'))),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxNetworkPolicyModes = Array.from(
    new Set(sandboxFinishedEvents.map((event) => String(event.payload.sandboxNetworkPolicyMode || 'unknown'))),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxNetworkOutboundAccessModes = Array.from(
    new Set(sandboxFinishedEvents.map((event) => String(event.payload.sandboxNetworkOutboundAccess || 'unknown'))),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxNetworkAllowedHosts = Array.from(
    new Set(
      sandboxFinishedEvents.flatMap((event) =>
        Array.isArray(event.payload.sandboxNetworkAllowedHosts)
          ? event.payload.sandboxNetworkAllowedHosts.map((host) => String(host))
          : [],
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxNetworkNotBlockedByDefaultCommandCount = sandboxFinishedEvents.filter(
    (event) => event.payload.sandboxNetworkBlockedByDefault === false,
  ).length;
  const sandboxNetworkUnrestrictedCommandCount = sandboxFinishedEvents.filter(
    (event) =>
      event.payload.sandboxNetworkAccess === 'unrestricted' ||
      event.payload.sandboxNetworkOutboundAccess === 'unrestricted' ||
      event.payload.sandboxNetworkPolicyMode === 'unrestricted',
  ).length;
  const sandboxFilesystemPersistenceModes = Array.from(
    new Set(sandboxFinishedEvents.map((event) => String(event.payload.sandboxFilesystemPersistence || 'unknown'))),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxCleanupPolicies = Array.from(
    new Set(sandboxFinishedEvents.map((event) => String(event.payload.sandboxCleanupPolicy || 'unknown'))),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxCleanupStatuses = Array.from(
    new Set(
      sandboxFinishedEvents.flatMap((event) =>
        typeof event.payload.cleanupStatus === 'string' ? [event.payload.cleanupStatus] : [],
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxEnvironmentPolicyModes = Array.from(
    new Set(
      sandboxFinishedEvents.map((event) => String(event.payload.sandboxEnvironmentPolicyMode || 'unknown')),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxExposedEnvKeys = Array.from(
    new Set(
      sandboxFinishedEvents.flatMap((event) =>
        Array.isArray(event.payload.sandboxExposedEnvKeys)
          ? event.payload.sandboxExposedEnvKeys.map((key) => String(key))
          : [],
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxResourceLimitValues = (field: string) =>
    sandboxFinishedEvents.flatMap((event) => {
      const limits = event.payload.sandboxResourceLimits;
      const value = limits && typeof limits === 'object'
        ? (limits as Record<string, unknown>)[field]
        : undefined;
      return typeof value === 'number' && Number.isFinite(value) ? [value] : [];
    });
  const maxSandboxResourceLimit = (field: string) => {
    const values = sandboxResourceLimitValues(field);
    return values.length ? Math.max(...values) : null;
  };
  const sandboxExecutionTimeoutMsMax = maxSandboxResourceLimit('executionTimeoutMs');
  const sandboxOutputLimitCharsMax = maxSandboxResourceLimit('outputLimitChars');
  const sandboxSnapshotFileLimitMax = maxSandboxResourceLimit('snapshotFileLimit');
  const sandboxSnapshotContentLimitMax = maxSandboxResourceLimit('snapshotContentLimit');
  const sandboxMemoryLimitMbMax = maxSandboxResourceLimit('memoryLimitMb');
  const sandboxCpuLimitMsMax = maxSandboxResourceLimit('cpuLimitMs');
  const sandboxCommandPolicyModes = Array.from(
    new Set(sandboxFinishedEvents.map((event) => String(event.payload.sandboxCommandPolicyMode || 'unknown'))),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxCommandPolicyBlockedCommandCount = sandboxFinishedEvents.filter(
    (event) => event.payload.skippedReason === 'command_not_allowed',
  ).length;
  const sandboxSnapshotCount = sandboxFinishedEvents.reduce((sum, event) => {
    const snapshotCount = Number(event.payload.snapshotCount || 0);
    return sum + (Number.isFinite(snapshotCount) ? snapshotCount : 0);
  }, 0);
  const sandboxPersistedSnapshotCount = sandboxFinishedEvents.reduce((sum, event) => {
    const snapshotCount = Number(event.payload.persistedSnapshotCount || 0);
    return sum + (Number.isFinite(snapshotCount) ? snapshotCount : 0);
  }, 0);
  const sandboxSkippedSnapshotCount = sandboxSnapshotEvents.reduce((sum, event) => {
    const snapshotCount = Number(event.payload.skippedSnapshotCount || 0);
    return sum + (Number.isFinite(snapshotCount) ? snapshotCount : 0);
  }, 0);
  const sandboxTimedOutCommandCount = sandboxFinishedEvents.filter((event) => event.payload.timedOut === true).length;
  const sandboxTotalDurationMs = sandboxFinishedEvents.reduce((sum, event) => {
    const durationMs = Number(event.payload.durationMs || 0);
    return sum + (Number.isFinite(durationMs) ? durationMs : 0);
  }, 0);
  const sandboxOutputTruncatedCommandCount = sandboxFinishedEvents.filter(
    (event) => event.payload.outputTruncated === true,
  ).length;
  const sandboxProviderErrorCommandCount = sandboxFinishedEvents.filter(
    (event) => event.payload.skippedReason === 'provider_error',
  ).length;
  const sandboxInvalidWorkspaceFileCommandCount = sandboxFinishedEvents.filter(
    (event) => event.payload.skippedReason === 'invalid_workspace_file_path',
  ).length;
  const sandboxExternalProviderUnconfiguredCommandCount = sandboxFinishedEvents.filter(
    (event) => event.payload.skippedReason === 'external_provider_unconfigured',
  ).length;
  const sandboxWorkspaceManifestMismatchCommandCount = sandboxFinishedEvents.filter(
    (event) => event.payload.skippedReason === 'workspace_manifest_mismatch',
  ).length;
  const sandboxCleanupFailedCommandCount = sandboxFinishedEvents.filter(
    (event) => event.payload.cleanupStatus === 'failed',
  ).length;
  const sandboxCleanupRetainedCommandCount = sandboxFinishedEvents.filter(
    (event) => event.payload.cleanupStatus === 'retained',
  ).length;
  const sandboxSecretsExposedCommandCount = sandboxFinishedEvents.filter(
    (event) => event.payload.sandboxSecretsExposed === true,
  ).length;
  const sandboxOutputStreamKinds = Array.from(
    new Set(
      sandboxFinishedEvents.flatMap((event) =>
        Array.isArray(event.payload.outputStreamKinds)
          ? event.payload.outputStreamKinds.map((stream) => String(stream))
          : [],
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxOutputChunkCount = sandboxFinishedEvents.reduce((sum, event) => {
    const outputChunkCount = Number(event.payload.outputChunkCount || 0);
    return sum + (Number.isFinite(outputChunkCount) ? outputChunkCount : 0);
  }, 0);
  const sandboxWorkspaceFileCountMax = sandboxFinishedEvents.reduce((max, event) => {
    const workspaceFileCount = Number(event.payload.workspaceFileCount || 0);
    return Math.max(max, Number.isFinite(workspaceFileCount) ? workspaceFileCount : 0);
  }, 0);
  const sandboxWorkspaceTotalBytesMax = sandboxFinishedEvents.reduce((max, event) => {
    const workspaceTotalBytes = Number(event.payload.workspaceTotalBytes || 0);
    return Math.max(max, Number.isFinite(workspaceTotalBytes) ? workspaceTotalBytes : 0);
  }, 0);
  const sandboxWorkspaceFilePaths = Array.from(
    new Set(
      sandboxFinishedEvents.flatMap((event) => {
        if (!Array.isArray(event.payload.workspaceFiles)) return [];
        return event.payload.workspaceFiles.flatMap((file) => {
          const path = workspaceFilePath(file);
          return path ? [path] : [];
        });
      }),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxWorkspaceDigests = Array.from(
    new Set(
      sandboxFinishedEvents.flatMap((event) =>
        typeof event.payload.workspaceDigest === 'string' ? [event.payload.workspaceDigest] : [],
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const sandboxTotalOutputChars = sandboxFinishedEvents.reduce((sum, event) => {
    const outputChars = Number(event.payload.outputChars || 0);
    return sum + (Number.isFinite(outputChars) ? outputChars : 0);
  }, 0);
  const testRuns = session.commandRuns.filter((run) => run.command.includes('test'));
  const lastRun = testRuns[testRuns.length - 1];
  const finalPassed = lastRun?.exitCode === 0;
  const failedRuns = testRuns.filter((run) => run.exitCode && run.exitCode !== 0).length;
  const totalCommands = session.commandRuns.length;
  const durationMinutes =
    session.startedAt && session.submittedAt
      ? Math.max(1, Math.round((session.submittedAt.getTime() - session.startedAt.getTime()) / 60000))
      : null;

  const evidence = {
    files: `${files.length} final file snapshots captured`,
    diffs: `${diffEvidence.summary.changedFileCount} changed file${diffEvidence.summary.changedFileCount === 1 ? '' : 's'} in final diff (+${diffEvidence.summary.totalAdditions}/-${diffEvidence.summary.totalDeletions})`,
    changes: `${fileChangeCount} file save events captured`,
    ai: `${aiPromptCount} AI prompt event${aiPromptCount === 1 ? '' : 's'} captured`,
    aiMix: aiStats.responseMixEvidence,
    tokenUsage: aiStats.totalTokens
      ? `${aiStats.totalTokens} total AI token${aiStats.totalTokens === 1 ? '' : 's'} captured (${aiStats.promptTokens} input, ${aiStats.completionTokens} output; ${aiStats.providerTokenResponses} provider-measured ${plural(aiStats.providerTokenResponses, 'response')})`
      : 'No AI token usage was captured',
    commands: `${totalCommands} command run${totalCommands === 1 ? '' : 's'} captured`,
    sandbox: sandboxFinishedEvents.length
      ? `${sandboxFinishedEvents.length} sandbox-backed command run${sandboxFinishedEvents.length === 1 ? '' : 's'} captured through ${sandboxProviderIds.join(', ')} provider${sandboxProviderIds.length === 1 ? '' : 's'} using ${sandboxExecutionModes.join(', ')} execution, ${sandboxReadinessStatuses.join(', ')} readiness, ${sandboxProductionReadyCommandCount} production-ready command${sandboxProductionReadyCommandCount === 1 ? '' : 's'}, ${sandboxNonProductionReadyCommandCount} non-production-ready command${sandboxNonProductionReadyCommandCount === 1 ? '' : 's'}, ${sandboxCapabilityGapList.length ? sandboxCapabilityGapList.join(', ') : 'no'} capability gap${sandboxCapabilityGapList.length === 1 ? '' : 's'}, ${sandboxRunIds.length} provider run id${sandboxRunIds.length === 1 ? '' : 's'}, ${sandboxIsolationLevels.join(', ')} isolation, ${sandboxNetworkAccessModes.join(', ')} network access, ${sandboxNetworkPolicyModes.join(', ')} network policy, ${sandboxNetworkNotBlockedByDefaultCommandCount} ${sandboxNetworkNotBlockedByDefaultCommandCount === 1 ? 'network policy' : 'network policies'} not blocked by default, ${sandboxNetworkUnrestrictedCommandCount} unrestricted network ${sandboxNetworkUnrestrictedCommandCount === 1 ? 'access' : 'accesses'}, ${sandboxFilesystemPersistenceModes.join(', ')} filesystem persistence, ${sandboxCleanupStatuses.join(', ') || 'unknown'} cleanup status, ${sandboxEnvironmentPolicyModes.join(', ')} environment policy, ${sandboxSecretsExposedCommandCount} secret-exposing environment${sandboxSecretsExposedCommandCount === 1 ? '' : 's'}, and ${sandboxCommandPolicyModes.join(', ')} command policy with ${sandboxExecutionTimeoutMsMax ?? 0}ms max timeout, ${sandboxOutputLimitCharsMax ?? 0} max output chars, ${sandboxSnapshotFileLimitMax ?? 0} max snapshot files, ${sandboxSnapshotContentLimitMax ?? 0} max snapshot bytes, ${sandboxSnapshotCount} snapshot file reference${sandboxSnapshotCount === 1 ? '' : 's'}, ${sandboxPersistedSnapshotCount} persisted snapshot${sandboxPersistedSnapshotCount === 1 ? '' : 's'}, ${sandboxSkippedSnapshotCount} skipped snapshot${sandboxSkippedSnapshotCount === 1 ? '' : 's'}, ${sandboxWorkspaceFileCountMax} max mounted workspace ${plural(sandboxWorkspaceFileCountMax, 'file')}, ${sandboxWorkspaceTotalBytesMax} max mounted workspace ${plural(sandboxWorkspaceTotalBytesMax, 'byte')}, ${sandboxWorkspaceDigests.length} mounted workspace ${plural(sandboxWorkspaceDigests.length, 'digest')}, ${sandboxWorkspaceManifestMismatchCommandCount} workspace manifest mismatch${sandboxWorkspaceManifestMismatchCommandCount === 1 ? '' : 'es'}, ${sandboxCleanupFailedCommandCount} cleanup failure${sandboxCleanupFailedCommandCount === 1 ? '' : 's'}, ${sandboxCleanupRetainedCommandCount} retained workspace${sandboxCleanupRetainedCommandCount === 1 ? '' : 's'}, ${sandboxTotalDurationMs}ms total provider runtime, ${sandboxTotalOutputChars} output char${sandboxTotalOutputChars === 1 ? '' : 's'} across ${sandboxOutputChunkCount} output chunk${sandboxOutputChunkCount === 1 ? '' : 's'} (${sandboxOutputStreamKinds.join(', ') || 'no stream labels'}), ${sandboxOutputTruncatedCommandCount} truncated output${sandboxOutputTruncatedCommandCount === 1 ? '' : 's'}, ${sandboxTimedOutCommandCount} timeout${sandboxTimedOutCommandCount === 1 ? '' : 's'}, ${sandboxProviderErrorCommandCount} provider error${sandboxProviderErrorCommandCount === 1 ? '' : 's'}, ${sandboxCommandPolicyBlockedCommandCount} command policy block${sandboxCommandPolicyBlockedCommandCount === 1 ? '' : 's'}, ${sandboxExternalProviderUnconfiguredCommandCount} unconfigured external provider${sandboxExternalProviderUnconfiguredCommandCount === 1 ? '' : 's'}, and ${sandboxInvalidWorkspaceFileCommandCount} invalid workspace input${sandboxInvalidWorkspaceFileCommandCount === 1 ? '' : 's'}`
      : 'No sandbox provider metadata was captured',
    tests: testRuns.length
      ? `${testRuns.length} test run${testRuns.length === 1 ? '' : 's'}; final run ${finalPassed ? 'passed' : 'did not pass'}`
      : 'No test runs captured',
    time: durationMinutes ? `${durationMinutes} minutes elapsed before submission` : 'No complete timing evidence',
  };

  const hasFinalFileEvidence = (pattern: RegExp) => files.some((file) => pattern.test(file.content));
  const isCheckoutChallenge = session.assessment.challenge.slug === 'debug-broken-checkout-flow';
  const solutionPlan = files.find((file) => file.path === 'src/solution-plan.ts')?.content || '';
  const noteCount = events.filter((event) => event.type === 'candidate_note_added').length;
  const hasQuantityValidation =
    hasFinalFileEvidence(/Number\.isInteger\(item\.quantity\)/) &&
    hasFinalFileEvidence(/item\.quantity\s*<=\s*0|item\.quantity\s*<\s*1/);
  const hasIdempotency = hasFinalFileEvidence(/idempotencyKey/);
  const hasRollback = hasFinalFileEvidence(/rollbackInventory/);
  const hasSolutionTodos = /TODO/i.test(solutionPlan);
  const hasConcreteRootCause =
    /rootCause\s*=\s*['"`][\s\S]{30,}?['"`]/.test(solutionPlan) &&
    !/rootCause\s*=\s*['"`][^'"`]*TODO/i.test(solutionPlan);
  const riskControlMatches = solutionPlan.match(/riskControls\s*=\s*\[[\s\S]*?\]/);
  const riskControlCount = riskControlMatches?.[0].match(/['"`][\s\S]*?['"`]/g)?.length || 0;
  const verificationMatches = solutionPlan.match(/verificationEvidence\s*=\s*\[[\s\S]*?\]/);
  const verificationCount = verificationMatches?.[0].match(/['"`][\s\S]*?['"`]/g)?.length || 0;
  const hasGenericTaskEvidence = hasConcreteRootCause && riskControlCount >= 2 && verificationCount >= 1 && !hasSolutionTodos;
  const taskName = session.assessment.challenge.title;

  const dimensionReports: DimensionReport[] = DIMENSIONS.map((dimension) => {
    switch (dimension) {
      case 'Problem Decomposition':
        return {
          dimension,
          score: scoreFromEvidence(fileChangeCount >= 3 && testRuns.length ? 4 : fileChangeCount ? 3 : 2),
          evidence: [evidence.changes, evidence.diffs, evidence.files, evidence.tests],
          strengths: fileChangeCount
            ? ['Touched the workspace in a way that creates observable decomposition evidence across saved files.']
            : ['No file-change evidence was captured, so decomposition strength is limited.'],
          concerns:
            fileChangeCount >= 3
              ? ['Assess whether the changes were ordered by risk, not only by file location.']
              : ['Limited file-change evidence makes task breakdown hard to verify.'],
          followUpQuestions: [`How did you split ${isCheckoutChallenge ? 'the checkout problem' : taskName} into smaller risks before editing?`],
        };
      case 'First-Principles Thinking':
        return {
          dimension,
          score: scoreFromEvidence(
            isCheckoutChallenge
              ? hasQuantityValidation && finalPassed ? 4 : hasQuantityValidation || finalPassed ? 3 : 2
              : hasConcreteRootCause && finalPassed ? 4 : hasConcreteRootCause || finalPassed ? 3 : 2,
          ),
          evidence: isCheckoutChallenge
            ? [
                hasQuantityValidation
                  ? 'Final files include complete invalid quantity validation evidence for non-integer and non-positive quantities.'
                  : 'No final-file evidence of complete invalid quantity validation was found.',
                evidence.tests,
              ]
            : [
                hasConcreteRootCause
                  ? 'Final files include a concrete root-cause explanation for the selected task.'
                  : 'No final-file evidence of a concrete root-cause explanation was found.',
                evidence.tests,
              ],
          strengths: isCheckoutChallenge
            ? hasQuantityValidation
              ? ['Addressed a core input invariant instead of only handling downstream symptoms.']
              : ['First-principles evidence is weak because the final files do not show the expected input invariant fix.']
            : hasConcreteRootCause
              ? ['Explained the first unsafe behavior in the task evidence instead of only listing symptoms.']
              : ['First-principles evidence is weak because the final files do not explain the root cause.'],
          concerns: finalPassed
            ? [
                isCheckoutChallenge
                  ? 'The simulated runner is still a narrow proof; discuss the invariant boundaries in interview.'
                  : 'The simulated runner is still a narrow proof; discuss how the evidence maps to production behavior.',
              ]
            : [
                isCheckoutChallenge
                  ? 'Captured tests do not show the invariant fix passing.'
                  : 'Captured tests do not show the custom task evidence passing.',
              ],
          followUpQuestions: [
            isCheckoutChallenge
              ? 'What checkout invariants should be true before payment is attempted?'
              : 'What invariant or boundary did you identify as the first unsafe behavior?',
          ],
        };
      case 'Creative Problem Solving':
        return {
          dimension,
          score: scoreFromEvidence(
            isCheckoutChallenge
              ? hasIdempotency && hasRollback && finalPassed ? 4 : fileChangeCount >= 2 ? 3 : 2
              : riskControlCount >= 2 && finalPassed ? 4 : riskControlCount ? 3 : 2,
          ),
          evidence: isCheckoutChallenge
            ? [
                hasIdempotency ? 'Final files include idempotency-key handling.' : 'No idempotency-key handling found in final files.',
                hasRollback ? 'Final files include rollback handling evidence.' : 'No rollback handling evidence found in final files.',
              ]
            : [
                `${riskControlCount} risk control${riskControlCount === 1 ? '' : 's'} captured in src/solution-plan.ts.`,
                evidence.tests,
              ],
          strengths: isCheckoutChallenge
            ? hasIdempotency || hasRollback
              ? ['Final files show at least one non-trivial checkout failure-mode improvement.']
              : ['No strong creative solution evidence was visible in final files.']
            : riskControlCount >= 2
              ? ['Final files show multiple risk controls for the custom task failure mode.']
              : ['No strong custom-task solution evidence was visible in final files.'],
          concerns: isCheckoutChallenge
            ? hasIdempotency && hasRollback
              ? ['Validate whether the solution generalizes beyond the simulated checkout runner.']
              : ['Payment retry or rollback coverage appears incomplete from final-file evidence.']
            : riskControlCount >= 2
              ? ['Validate whether the proposed controls map to real code paths, not only documentation.']
              : ['Risk controls appear incomplete from final-file evidence.'],
          followUpQuestions: [
            isCheckoutChallenge
              ? 'What alternative fix did you consider for payment failure recovery, and why did you reject it?'
              : 'What alternative control did you consider for this failure mode, and why did you reject it?',
          ],
        };
      case 'Iteration Quality':
        return {
          dimension,
          score: scoreFromEvidence(fileChangeCount >= 3 && testRuns.length >= 2 ? 4 : fileChangeCount >= 1 && testRuns.length >= 1 ? 3 : 2),
          evidence: [evidence.changes, evidence.diffs, evidence.tests, `${failedRuns} failed test run${failedRuns === 1 ? '' : 's'} before submission`],
          strengths: fileChangeCount && testRuns.length ? ['Changed files and used runner feedback in the same session.'] : ['Iteration evidence is sparse in the captured timeline.'],
          concerns: fileChangeCount && testRuns.length ? ['Review whether each iteration responded to a specific failing signal.'] : ['Limited evidence of edit-test-debug iteration.'],
          followUpQuestions: ['Walk through the first failing signal and how it changed your next step.'],
        };
      case 'Debugging with AI':
        return {
          dimension,
          score: scoreFromEvidence(
            aiStats.usefulResponses && testRuns.length && !aiStats.guardrailResponses && !aiStats.fallbackResponses
              ? 4
              : aiStats.usefulResponses && testRuns.length
                ? 3
                : aiStats.usefulResponses
                  ? 3
                  : aiPromptCount
                    ? 2
                    : testRuns.length
                      ? 3
                      : 2,
          ),
          evidence: [
            evidence.ai,
            evidence.aiMix,
            evidence.tests,
            `${diffEvidence.checkpoints.length} important checkpoint${diffEvidence.checkpoints.length === 1 ? '' : 's'} captured for review`,
          ],
          strengths: aiStats.usefulResponses && testRuns.length
            ? ['Useful AI guidance was followed by command/test evidence.']
            : aiStats.usefulResponses
              ? ['Used the in-product AI assistant during the task.']
              : ['No AI usage was captured, so this dimension relies on non-AI debugging evidence.'],
          concerns: [
            ...(aiPromptCount && !testRuns.length ? ['AI was used without captured test verification.'] : []),
            ...(aiStats.guardrailResponses ? ['Some AI turns were clarification guardrails, not substantive debugging help.'] : []),
            ...(aiStats.fallbackResponses ? ['Provider fallback responses should be treated as platform reliability context, not candidate failure.'] : []),
            'Ask how the candidate checked whether AI advice was correct.',
          ],
          followUpQuestions: ['Which AI suggestion did you verify, modify, or reject, and what evidence did you use?'],
        };
      case 'Architecture Decisions':
        return {
          dimension,
          score: scoreFromEvidence(
            isCheckoutChallenge
              ? hasIdempotency && hasRollback && finalPassed ? 4 : hasIdempotency || hasRollback ? 3 : 2
              : hasGenericTaskEvidence && finalPassed ? 4 : riskControlCount >= 2 ? 3 : 2,
          ),
          evidence: isCheckoutChallenge
            ? [
                hasIdempotency ? 'Final files include idempotency-key handling.' : 'No idempotency-key handling found in final files.',
                hasRollback ? 'Final files include rollback handling evidence.' : 'No rollback handling evidence found in final files.',
                evidence.tests,
              ]
            : [
                hasConcreteRootCause ? 'Final files include root-cause evidence.' : 'No concrete root-cause evidence found.',
                `${riskControlCount} risk control${riskControlCount === 1 ? '' : 's'} captured.`,
                evidence.tests,
              ],
          strengths: isCheckoutChallenge
            ? hasIdempotency && hasRollback
              ? ['Final files show payment integrity and recovery decisions.']
              : ['Architecture evidence is partial from the captured final files.']
            : hasGenericTaskEvidence
              ? ['Final files connect root cause, controls, and verification evidence for the task boundary.']
              : ['Architecture evidence is partial from the captured final files.'],
          concerns: finalPassed
            ? [
                isCheckoutChallenge
                  ? 'The simulated environment does not prove production transaction semantics.'
                  : 'The simulated environment does not prove production behavior for the custom task.',
              ]
            : ['The captured runner did not prove the architecture choices with a final pass.'],
          followUpQuestions: [
            isCheckoutChallenge
              ? 'How would you structure the payment and inventory boundary in a production checkout service?'
              : 'Which system boundary should own the fix in a production version of this task?',
          ],
        };
      case 'Communication Clarity':
        return {
          dimension,
          score: scoreFromEvidence(aiPromptCount || noteCount ? 3 : 2),
          evidence: [evidence.ai, `${noteCount} candidate note event${noteCount === 1 ? '' : 's'} captured`],
          strengths:
            aiPromptCount || noteCount
              ? ['Captured notes or AI prompts provide some written reasoning evidence.']
              : ['No written communication artifacts were captured beyond code and commands.'],
          concerns: ['A reviewer should inspect the exact notes and prompts for clarity, assumptions, and tradeoffs.'],
          followUpQuestions: [
            isCheckoutChallenge
              ? 'How would you explain the checkout fix and remaining risks to a product manager?'
              : 'How would you explain this task fix and remaining risks to a product manager?',
          ],
        };
      case 'Token Efficiency':
        return {
          dimension,
          score: scoreFromEvidence(
            !aiStats.promptCount
              ? finalPassed ? 4 : 3
              : aiStats.totalTokens && aiStats.totalTokens <= 900 && aiStats.usefulResponses >= aiStats.guardrailResponses + aiStats.fallbackResponses
                ? finalPassed ? 4 : 3
                : aiStats.totalTokens && aiStats.totalTokens <= 3000
                  ? 3
                  : 2,
          ),
          evidence: [evidence.time, evidence.commands, evidence.ai, evidence.tokenUsage],
          strengths:
            aiStats.promptCount <= 2
              ? ['AI prompt volume stayed low in the captured session.']
              : ['AI token usage is captured and can be reviewed for efficiency.'],
          concerns: finalPassed
            ? ['Low token volume alone does not prove strong token efficiency; inspect prompt quality and whether useful context was omitted.']
            : ['Efficiency evidence is weaker without a final passing captured runner.'],
          followUpQuestions: ['What context would you include or omit to keep an AI debugging prompt concise?'],
        };
      default:
        return {
          dimension,
          score: scoreFromEvidence(fileChangeCount || aiPromptCount || totalCommands ? 3 : 2),
          evidence: [evidence.changes, evidence.diffs, evidence.ai, evidence.commands],
          strengths: fileChangeCount || aiPromptCount ? ['Session contains observable work-process evidence.'] : [],
          concerns: fileChangeCount || aiPromptCount ? [] : ['Sparse telemetry limits confidence for this dimension.'],
          followUpQuestions: ['How did you decide the order of fixes for this challenge?'],
        };
    }
  });

  const overallScore = Number(
    (dimensionReports.reduce((sum, dimension) => sum + dimension.score, 0) / dimensionReports.length).toFixed(1),
  );

  const overallRecommendation =
    overallScore >= 4.5 ? 'strong_yes' : overallScore >= 3.8 ? 'yes' : overallScore >= 3 ? 'maybe' : overallScore >= 2 ? 'no' : 'strong_no';

  const riskFlags = [
    ...(!testRuns.length ? ['no_tests_run'] : []),
    ...(!finalPassed ? ['final_tests_not_passing'] : []),
    ...(aiPromptCount && !testRuns.length ? ['ai_used_without_test_verification'] : []),
    ...(aiOverdelegationPromptCount && (fileChangeCount <= 1 || !testRuns.length) ? ['ai_overdelegation_risk'] : []),
    ...(aiStats.guardrailResponses ? ['ai_guardrails_triggered'] : []),
    ...(aiStats.fallbackResponses ? ['ai_provider_fallback'] : []),
    ...(sandboxProviderErrorCommandCount ? ['sandbox_provider_error'] : []),
    ...(sandboxCommandPolicyBlockedCommandCount ? ['sandbox_command_policy_blocked'] : []),
    ...(sandboxInvalidWorkspaceFileCommandCount ? ['sandbox_invalid_workspace_file_path'] : []),
    ...(sandboxExternalProviderUnconfiguredCommandCount ? ['sandbox_external_provider_unconfigured'] : []),
    ...(sandboxWorkspaceManifestMismatchCommandCount ? ['sandbox_workspace_manifest_mismatch'] : []),
    ...(sandboxCleanupFailedCommandCount ? ['sandbox_cleanup_failed'] : []),
    ...(sandboxCleanupRetainedCommandCount ? ['sandbox_workspace_retained'] : []),
    ...(sandboxSecretsExposedCommandCount ? ['sandbox_secrets_exposed'] : []),
    ...(sandboxNetworkNotBlockedByDefaultCommandCount ? ['sandbox_network_not_blocked_by_default'] : []),
    ...(sandboxNetworkUnrestrictedCommandCount ? ['sandbox_unrestricted_network_access'] : []),
    ...(sandboxNetworkAccessModes.includes('host_inherited') ? ['sandbox_host_network_inherited'] : []),
    ...(sandboxNonProductionReadyCommandCount ? ['sandbox_not_production_ready'] : []),
    ...(sandboxNotProductionIsolated ? ['sandbox_not_production_isolated'] : []),
  ];
  const scoreBreakdown = dimensionReports.map((dimension) => ({
    dimension: dimension.dimension,
    score: dimension.score,
    evidenceSummary: compactText(dimension.evidence.join(' '), 260),
    concernSummary: compactText(dimension.concerns.join(' '), 260),
    rationale: compactText([...dimension.strengths, ...dimension.concerns].join(' '), 260),
  }));
  const weakestDimensions = [...dimensionReports]
    .sort((a, b) => a.score - b.score || a.dimension.localeCompare(b.dimension))
    .slice(0, 3);
  const areasForGrowth = [
    ...weakestDimensions.map((dimension) => ({
      title: dimension.dimension,
      detail: compactText(
        dimension.concerns[0] || dimension.followUpQuestions[0] || 'Review this dimension with the candidate.',
        220,
      ),
    })),
    ...riskFlags.slice(0, 2).map((flag) => ({
      title: flag.replaceAll('_', ' '),
      detail: flag.startsWith('sandbox_')
        ? 'Treat sandbox evidence as assessment context and confirm production readiness separately.'
        : 'Review the captured timeline and evidence before making a hiring decision.',
    })),
  ].slice(0, 5);
  const eventById = new Map(events.map((event) => [event.id, event]));
  const checkpointCommandRunIds = new Set(
    diffEvidence.checkpoints.flatMap((checkpoint) => {
      const payload = eventById.get(checkpoint.id)?.payload;
      return typeof payload?.commandRunId === 'string' ? [payload.commandRunId] : [];
    }),
  );
  const checkpointAiMessageIds = new Set(
    diffEvidence.checkpoints.flatMap((checkpoint) => {
      const payload = eventById.get(checkpoint.id)?.payload;
      return typeof payload?.aiMessageId === 'string' ? [payload.aiMessageId] : [];
    }),
  );
  const unidentifiedCheckpointCounts = new Map<string, number>();
  for (const checkpoint of diffEvidence.checkpoints) {
    const payload = eventById.get(checkpoint.id)?.payload;
    const hasKnownEntity =
      typeof payload?.commandRunId === 'string' || typeof payload?.aiMessageId === 'string';
    if (!hasKnownEntity) {
      unidentifiedCheckpointCounts.set(
        checkpoint.type,
        (unidentifiedCheckpointCounts.get(checkpoint.type) || 0) + 1,
      );
    }
  }
  const hasUnidentifiedCheckpoint = (type: string) => {
    const count = unidentifiedCheckpointCounts.get(type) || 0;
    if (!count) return false;
    unidentifiedCheckpointCounts.set(type, count - 1);
    return true;
  };
  const keyMomentSeverity = (checkpointId: string, type: string) => {
    const payload = eventById.get(checkpointId)?.payload;
    if (type === 'test_run_finished') {
      const exitCode = payload?.exitCode;
      return typeof exitCode === 'number' && exitCode !== 0 ? 'warning' : null;
    }

    if (type === 'ai_response_received' && (aiStats.guardrailResponses || aiStats.fallbackResponses)) {
      return 'info';
    }

    return null;
  };
  const commandRunSummary = (run: (typeof session.commandRuns)[number]) => {
    if (run.exitCode === 0) return `${run.command} passed`;
    if (typeof run.exitCode === 'number') return `${run.command} did not pass`;
    return `${run.command} completed without exit code`;
  };
  const sortedKeyMoments = [
    ...diffEvidence.checkpoints.map((checkpoint) => ({
      type: checkpoint.type,
      title: checkpoint.label,
      occurredAt: checkpoint.occurredAt,
      summary: checkpoint.summary,
      ...(keyMomentSeverity(checkpoint.id, checkpoint.type)
        ? { severity: keyMomentSeverity(checkpoint.id, checkpoint.type) }
        : {}),
    })),
    ...session.commandRuns
      .filter((run) => {
        if (checkpointCommandRunIds.has(run.id)) return false;
        const type = run.command.includes('test') ? 'test_run_finished' : 'command_finished';
        return !hasUnidentifiedCheckpoint(type);
      })
      .map((run) => ({
        type: run.command.includes('test') ? 'test_run_finished' : 'command_finished',
        title: run.command.includes('test') ? 'Test run finished' : 'Command finished',
        occurredAt: (run.finishedAt || run.startedAt).toISOString(),
        summary: commandRunSummary(run),
        ...(typeof run.exitCode === 'number' && run.exitCode !== 0 ? { severity: 'warning' } : {}),
      })),
    ...session.aiMessages
      .filter((message) => message.role === 'assistant')
      .filter((message) => {
        if (checkpointAiMessageIds.has(message.id)) return false;
        return !hasUnidentifiedCheckpoint('ai_response_received');
      })
      .map((message) => ({
        type: 'ai_response_received',
        title: 'AI response received',
        occurredAt: message.createdAt.toISOString(),
        summary: `AI response captured (${message.content.length} chars)`,
      })),
  ]
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const sessionEndedKeyMoment = [...sortedKeyMoments].reverse().find((moment) => moment.type === 'session_ended');
  const keyMoments =
    sortedKeyMoments.length <= 8 || !sessionEndedKeyMoment
      ? sortedKeyMoments.slice(0, 8)
      : [
          ...sortedKeyMoments.filter((moment) => moment !== sessionEndedKeyMoment).slice(0, 7),
          sessionEndedKeyMoment,
        ].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const commandRunSeconds = Math.round(
    session.commandRuns.reduce((sum, run) => {
      if (!run.finishedAt) return sum;
      return sum + Math.max(0, run.finishedAt.getTime() - run.startedAt.getTime()) / 1000;
    }, 0),
  );
  const activityBreakdown = [
    ...(noteCount || session.startedAt
      ? [{ category: 'Planning', count: noteCount || 1, seconds: 0, minutes: 0 }]
      : []),
    ...(fileChangeCount || diffEvidence.summary.changedFileCount
      ? [
          {
            category: 'Coding',
            count: Math.max(fileChangeCount, diffEvidence.summary.changedFileCount),
            seconds: 0,
            minutes: 0,
          },
        ]
      : []),
    ...(testRuns.length || failedRuns
      ? [{ category: 'Debugging', count: testRuns.length, seconds: commandRunSeconds, minutes: Math.round(commandRunSeconds / 60) }]
      : []),
    ...(aiStats.promptCount ? [{ category: 'Prompting', count: aiStats.promptCount, seconds: 0, minutes: 0 }] : []),
    ...(diffEvidence.checkpoints.length
      ? [
          {
            category: 'Reviewing',
            count: diffEvidence.checkpoints.length,
            seconds: durationMinutes ? durationMinutes * 60 : 0,
            minutes: durationMinutes || 0,
          },
        ]
      : []),
  ];
  const promptComplexity = session.aiMessages
    .filter((message) => message.role === 'user')
    .map((message) => ({
      occurredAt: message.createdAt.toISOString(),
      score: promptComplexityScore(message.content),
      excerpt: compactText(message.content, 140),
    }));
  const firstWorkAt = isoDate(
    events.find((event) =>
      ['file_changed', 'file_saved', 'command_started', 'test_run_started', 'ai_prompt_sent'].includes(event.type),
    )?.occurredAt,
  );
  const submissionAt = isoDate(session.submittedAt || events.find((event) => event.type === 'session_ended')?.occurredAt);
  const narrativePhases = [
    {
      title: 'Initial Problem Framing',
      timeRange: [isoDate(session.startedAt || events[0]?.occurredAt), firstWorkAt].filter(Boolean).join(' to ') || null,
      summary: noteCount || aiPromptCount
        ? 'Candidate left planning or AI-assistant evidence before or during early work.'
        : 'Early framing evidence is limited; use follow-up questions to understand the starting plan.',
      evidenceItems: [evidence.ai, `${noteCount} candidate note event${noteCount === 1 ? '' : 's'} captured`],
    },
    {
      title: 'Implementation and Verification',
      timeRange: [firstWorkAt, submissionAt].filter(Boolean).join(' to ') || null,
      summary: `${evidence.changes}. ${evidence.tests}.`,
      evidenceItems: [
        evidence.diffs,
        evidence.commands,
        ...diffEvidence.checkpoints
          .filter((checkpoint) => ['file_saved', 'test_run_finished', 'ai_response_received'].includes(checkpoint.type))
          .slice(0, 3)
          .map((checkpoint) => checkpoint.summary),
      ],
    },
    {
      title: 'Submission Evidence',
      timestamp: submissionAt,
      summary: finalPassed
        ? 'Candidate submitted after a passing captured runner.'
        : 'Candidate submitted without a final passing captured runner.',
      evidenceItems: [
        evidence.tests,
        evidence.time,
        diffEvidence.checkpoints.find((checkpoint) => checkpoint.type === 'session_ended')?.summary || 'Submission recorded',
      ],
    },
  ];

  const reportJson = {
    rubricVersion: RUBRIC_VERSION,
    modelMetadata: {
      evaluator: {
        provider: EVALUATOR_PROVIDER,
        model: EVALUATOR_MODEL,
        generatedAt: new Date().toISOString(),
      },
      sandbox: {
        providerIds: sandboxProviderIds,
        providerKinds: sandboxProviderKinds,
        executionModes: sandboxExecutionModes,
        sandboxRunIds,
        readinessStatuses: sandboxReadinessStatuses,
        capabilityStatuses: sandboxCapabilityStatuses,
        capabilityGaps: sandboxCapabilityGapList,
        productionReadyCommandCount: sandboxProductionReadyCommandCount,
        nonProductionReadyCommandCount: sandboxNonProductionReadyCommandCount,
        isolationLevels: sandboxIsolationLevels,
        networkAccessModes: sandboxNetworkAccessModes,
        networkPolicyModes: sandboxNetworkPolicyModes,
        networkOutboundAccessModes: sandboxNetworkOutboundAccessModes,
        networkAllowedHosts: sandboxNetworkAllowedHosts,
        networkNotBlockedByDefaultCommandCount: sandboxNetworkNotBlockedByDefaultCommandCount,
        networkUnrestrictedCommandCount: sandboxNetworkUnrestrictedCommandCount,
        filesystemPersistenceModes: sandboxFilesystemPersistenceModes,
        cleanupPolicies: sandboxCleanupPolicies,
        cleanupStatuses: sandboxCleanupStatuses,
        environmentPolicyModes: sandboxEnvironmentPolicyModes,
        exposedEnvKeys: sandboxExposedEnvKeys,
        secretsExposedCommandCount: sandboxSecretsExposedCommandCount,
        executionTimeoutMsMax: sandboxExecutionTimeoutMsMax,
        outputLimitCharsMax: sandboxOutputLimitCharsMax,
        snapshotFileLimitMax: sandboxSnapshotFileLimitMax,
        snapshotContentLimitMax: sandboxSnapshotContentLimitMax,
        memoryLimitMbMax: sandboxMemoryLimitMbMax,
        cpuLimitMsMax: sandboxCpuLimitMsMax,
        commandPolicyModes: sandboxCommandPolicyModes,
        commandPolicyBlockedCommandCount: sandboxCommandPolicyBlockedCommandCount,
        commandRunsWithMetadata: sandboxFinishedEvents.length,
        snapshotCount: sandboxSnapshotCount,
        persistedSnapshotCount: sandboxPersistedSnapshotCount,
        skippedSnapshotCount: sandboxSkippedSnapshotCount,
        cleanupFailedCommandCount: sandboxCleanupFailedCommandCount,
        cleanupRetainedCommandCount: sandboxCleanupRetainedCommandCount,
        timedOutCommandCount: sandboxTimedOutCommandCount,
        outputTruncatedCommandCount: sandboxOutputTruncatedCommandCount,
        outputChunkCount: sandboxOutputChunkCount,
        outputStreamKinds: sandboxOutputStreamKinds,
        workspaceFileCountMax: sandboxWorkspaceFileCountMax,
        workspaceTotalBytesMax: sandboxWorkspaceTotalBytesMax,
        workspaceFilePaths: sandboxWorkspaceFilePaths,
        workspaceDigests: sandboxWorkspaceDigests,
        workspaceManifestMismatchCommandCount: sandboxWorkspaceManifestMismatchCommandCount,
        providerErrorCommandCount: sandboxProviderErrorCommandCount,
        invalidWorkspaceFileCommandCount: sandboxInvalidWorkspaceFileCommandCount,
        externalProviderUnconfiguredCommandCount: sandboxExternalProviderUnconfiguredCommandCount,
        totalOutputChars: sandboxTotalOutputChars,
        totalDurationMs: sandboxTotalDurationMs,
      },
    },
    overallRecommendation,
    overallScore,
    summary: finalPassed
      ? `${session.candidate.name} submitted ${isCheckoutChallenge ? 'a checkout fix' : `work for ${taskName}`} with passing captured tests and ${aiPromptCount} AI prompt event${aiPromptCount === 1 ? '' : 's'}.`
      : `${session.candidate.name} submitted with incomplete captured test evidence; review the timeline before making a decision.`,
    dimensionScores: dimensionReports,
    scoreBreakdown,
    areasForGrowth,
    keyMoments,
    activityBreakdown,
    promptComplexity,
    narrativePhases,
    timelineSummary: `${evidence.time}. ${evidence.changes}. ${evidence.diffs}. ${evidence.ai}. ${evidence.tests}. ${evidence.sandbox}.`,
    codeQualitySummary: finalPassed
      ? isCheckoutChallenge
        ? 'Final code satisfied the simulated checkout checks. Reviewer should still inspect edge cases and production payment semantics.'
        : 'Final work satisfied the simulated custom-task checks. Reviewer should still inspect whether the evidence maps to production behavior.'
      : 'Final code needs human review because the captured runner did not show a clean final pass.',
    aiUsageSummary: aiPromptCount
      ? `Candidate used the AI assistant ${aiStats.promptCount} time${aiStats.promptCount === 1 ? '' : 's'}: ${aiStats.responseMixEvidence}; verification evidence is ${testRuns.length ? 'present through test runs' : 'not present in command logs'}.${aiOverdelegationPromptCount ? ` ${aiOverdelegationPromptCount} prompt${aiOverdelegationPromptCount === 1 ? '' : 's'} asked the assistant to take over implementation or broad code review, so reviewers should inspect ownership carefully.` : ''}`
      : 'No AI assistant usage was captured.',
    sandboxSummary: evidence.sandbox,
    tokenUsageSummary: {
      promptCount: aiStats.promptCount,
      responseCount: aiStats.responseCount,
      usefulResponses: aiStats.usefulResponses,
      guardrailResponses: aiStats.guardrailResponses,
      fallbackResponses: aiStats.fallbackResponses,
      providerTokenResponses: aiStats.providerTokenResponses,
      estimatedTokenResponses: aiStats.estimatedTokenResponses,
      promptTokens: aiStats.promptTokens,
      completionTokens: aiStats.completionTokens,
      totalTokens: aiStats.totalTokens,
    },
    aiCaveats: aiStats.aiCaveats,
    riskFlags,
    nextInterviewFocus: [
      isCheckoutChallenge
        ? 'Ask the candidate to explain payment idempotency and rollback behavior.'
        : 'Ask the candidate to explain the root cause and why their selected controls address it.',
      'Review how they validated AI suggestions.',
      isCheckoutChallenge
        ? 'Discuss what production tests would replace the simulated checks.'
        : 'Discuss what production tests or observability would replace the simulated custom-task checks.',
    ],
    diffSummary: {
      changedFileCount: diffEvidence.summary.changedFileCount,
      totalAdditions: diffEvidence.summary.totalAdditions,
      totalDeletions: diffEvidence.summary.totalDeletions,
      changedFiles: diffEvidence.changedFiles.map((file) => ({
        path: file.path,
        additions: file.additions,
        deletions: file.deletions,
      })),
      checkpoints: diffEvidence.checkpoints.map((checkpoint) => ({
        type: checkpoint.type,
        summary: checkpoint.summary,
        occurredAt: checkpoint.occurredAt,
      })),
    },
  };

  const saved = await db.evaluationReport.upsert({
    where: { sessionId: session.id },
    update: {
      overallRecommendation,
      overallScore,
      summary: reportJson.summary,
      reportJson: toJson(reportJson),
      generatedBy: EVALUATOR_MODEL,
    },
    create: {
      sessionId: session.id,
      overallRecommendation,
      overallScore,
      summary: reportJson.summary,
      reportJson: toJson(reportJson),
      generatedBy: EVALUATOR_MODEL,
    },
  });

  await db.scoreDimension.deleteMany({ where: { reportId: saved.id } });
  await db.scoreDimension.createMany({
    data: dimensionReports.map((dimension) => ({
      reportId: saved.id,
      dimension: dimension.dimension,
      score: dimension.score,
      evidenceJson: toJson(dimension.evidence),
      strengthsJson: toJson(dimension.strengths),
      concernsJson: toJson(dimension.concerns),
      followUpQuestionsJson: toJson(dimension.followUpQuestions),
    })),
  });

  await db.candidateSession.update({
    where: { id: session.id },
    data: { status: 'report_ready' },
  });

  return saved;
}
