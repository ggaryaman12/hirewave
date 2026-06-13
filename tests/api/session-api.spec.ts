import { expect, test } from '@playwright/test';
import { db } from '../../lib/db';
import {
  PASSING_CHECKOUT_TS,
  PASSING_CART_TS,
  PASSING_PAYMENT_TS,
  createCandidateSessionFixture,
  uniqueTestEmail,
} from '../helpers/session-fixtures';
import { generateEvaluationReport } from '../../lib/evaluation/generate-report';
import { getSessionByToken, serializeSession } from '../../lib/sessions';

const ENTERPRISE_RUBRIC_DIMENSIONS = [
  'Problem Decomposition',
  'First-Principles Thinking',
  'Creative Problem Solving',
  'Iteration Quality',
  'Debugging with AI',
  'Architecture Decisions',
  'Communication Clarity',
  'Token Efficiency',
];

const SHA_256_HEX = /^[a-f0-9]{64}$/;
const SANDBOX_RUN_ID = /^[a-z0-9-]+:[0-9a-f-]{36}$/;
const SIMULATED_CAPABILITY_STATUSES = {
  realCodeExecution: 'not_supported',
  productionIsolation: 'not_supported',
  commandPolicy: 'supported',
  networkPolicy: 'not_applicable',
  environmentPolicy: 'not_applicable',
  resourceLimits: 'not_applicable',
  workspaceSnapshots: 'supported',
  cleanupEvidence: 'not_applicable',
};
const LOCAL_DEV_CAPABILITY_STATUSES = {
  realCodeExecution: 'partial',
  productionIsolation: 'not_supported',
  commandPolicy: 'supported',
  networkPolicy: 'not_supported',
  environmentPolicy: 'supported',
  resourceLimits: 'partial',
  workspaceSnapshots: 'supported',
  cleanupEvidence: 'supported',
};
const EXTERNAL_UNCONFIGURED_CAPABILITY_STATUSES = {
  realCodeExecution: 'not_supported',
  productionIsolation: 'not_supported',
  commandPolicy: 'not_supported',
  networkPolicy: 'not_supported',
  environmentPolicy: 'not_supported',
  resourceLimits: 'not_supported',
  workspaceSnapshots: 'not_supported',
  cleanupEvidence: 'not_supported',
};
const CONFIGURED_UNSAFE_EXTERNAL_CAPABILITY_STATUSES = {
  realCodeExecution: 'supported',
  productionIsolation: 'supported',
  commandPolicy: 'provider_managed',
  networkPolicy: 'not_supported',
  environmentPolicy: 'provider_managed',
  resourceLimits: 'partial',
  workspaceSnapshots: 'provider_managed',
  cleanupEvidence: 'provider_managed',
};
const CONFIGURED_SECRET_EXPOSING_EXTERNAL_CAPABILITY_STATUSES = {
  realCodeExecution: 'supported',
  productionIsolation: 'supported',
  commandPolicy: 'provider_managed',
  networkPolicy: 'supported',
  environmentPolicy: 'not_supported',
  resourceLimits: 'partial',
  workspaceSnapshots: 'provider_managed',
  cleanupEvidence: 'provider_managed',
};

function sandboxCapabilityGaps(statuses: Record<string, string>) {
  return Object.entries(statuses)
    .flatMap(([capability, status]) => (['not_supported', 'partial', 'unknown'].includes(status) ? [capability] : []))
    .sort((a, b) => a.localeCompare(b));
}

function sandboxCapabilityPayload(readiness: string, statuses: Record<string, string>) {
  return {
    sandboxReadinessStatus: readiness,
    sandboxCapabilityStatuses: statuses,
    sandboxCapabilityGaps: sandboxCapabilityGaps(statuses),
  };
}

const PARTIAL_QUANTITY_CART_TS = PASSING_CART_TS.replace(
  'if (!Number.isInteger(item.quantity) || item.quantity <= 0) {',
  'if (item.quantity <= 0) {',
);

test.describe('session API', () => {
  test('captures telemetry, file edits, commands, AI messages, submission, and closed-session guards', async ({ request }) => {
    const { session, sessionToken } = await createCandidateSessionFixture({
      name: 'API Test Candidate',
      email: uniqueTestEmail('api'),
    });

    const eventResponse = await request.post(`/api/session/${sessionToken}/events`, {
      data: {
        type: 'candidate_note_added',
        payload: { note: 'Starting with cart validation.' },
      },
    });
    expect(eventResponse.ok()).toBeTruthy();

    const fileResponse = await request.post(`/api/session/${sessionToken}/files`, {
      data: {
        path: 'src/cart.ts',
        language: 'typescript',
        content: PASSING_CART_TS,
      },
    });
    expect(fileResponse.ok()).toBeTruthy();
    const fileBody = await fileResponse.json();
    expect(fileBody.snapshot.path).toBe('src/cart.ts');
    expect(fileBody.snapshot.version).toBe(2);

    const unsafeFileResponse = await request.post(`/api/session/${sessionToken}/files`, {
      data: {
        path: '../secret.ts',
        language: 'typescript',
        content: 'export const secret = true;',
      },
    });
    expect(unsafeFileResponse.status()).toBe(400);
    expect((await unsafeFileResponse.json()).error).toContain('Unsafe workspace file path');
    const unsafeSnapshot = await db.fileSnapshot.findFirst({
      where: { sessionId: session.id, path: '../secret.ts' },
    });
    expect(unsafeSnapshot).toBeNull();

    const commandResponse = await request.post(`/api/session/${sessionToken}/commands`, {
      data: { command: 'npm test' },
    });
    expect(commandResponse.ok()).toBeTruthy();
    const commandBody = await commandResponse.json();
    expect(commandBody.commandRun.command).toBe('npm test');
    expect(commandBody.commandRun.output).toContain('Simulated checkout test runner');
    expect(commandBody.commandRun.testResults).toHaveLength(4);
    expect(commandBody.commandRun.sandbox).toEqual({
      providerId: 'simulated',
      providerKind: 'simulated',
      executionMode: 'simulated',
      isolationLevel: 'none',
      networkAccess: 'none',
      networkPolicy: {
        mode: 'none',
        outboundAccess: 'none',
        allowedHosts: [],
        blockedByDefault: true,
      },
      capabilities: {
        readiness: 'demo_only',
        ...SIMULATED_CAPABILITY_STATUSES,
      },
      filesystemPersistence: 'virtual',
      cleanupPolicy: 'not_applicable',
      commandPolicy: expect.objectContaining({
        mode: 'simulated_allowlist',
        blockedByDefault: true,
      }),
      snapshotCount: expect.any(Number),
      persistedSnapshotCount: 0,
      execution: expect.objectContaining({
        durationMs: expect.any(Number),
        timedOut: false,
        cleanupStatus: 'not_applicable',
        outputTruncated: false,
      }),
    });

    const reloadedSession = await getSessionByToken(sessionToken);
    if (!reloadedSession) throw new Error('Expected session to reload after command run');
    const serializedSession = serializeSession(reloadedSession);
    expect(serializedSession.commandRuns[0].outputChunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stream: 'system', content: expect.stringContaining('$ npm test') }),
        expect.objectContaining({ stream: 'stdout', content: expect.stringContaining('Simulated checkout test runner') }),
      ]),
    );
    expect(serializedSession.commandRuns[0].sandbox).toEqual(
      expect.objectContaining({
        providerId: 'simulated',
        providerKind: 'simulated',
        executionMode: 'simulated',
        isolationLevel: 'none',
        capabilities: expect.objectContaining({
          readiness: 'demo_only',
        }),
        execution: expect.objectContaining({
          sandboxRunId: expect.stringMatching(SANDBOX_RUN_ID),
          cleanupStatus: 'not_applicable',
          outputTruncated: false,
        }),
      }),
    );

    const aiResponse = await request.post(`/api/session/${sessionToken}/ai`, {
      data: { message: 'How should I approach the failing checkout tests?' },
    });
    expect(aiResponse.ok()).toBeTruthy();
    const aiBody = await aiResponse.json();
    expect(aiBody.messages).toHaveLength(2);
    expect(aiBody.messages[0].role).toBe('user');
    expect(aiBody.messages[1].role).toBe('assistant');
    expect(aiBody.messages[1].content.length).toBeGreaterThan(10);

    const events = await db.sessionEvent.findMany({
      where: { sessionId: session.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        'candidate_note_added',
        'file_changed',
        'file_saved',
        'test_run_started',
        'command_output',
        'test_run_finished',
        'ai_prompt_sent',
        'ai_response_received',
      ]),
    );
    const finishedCommandEvent = events.find((event) => event.type === 'test_run_finished');
    expect(JSON.parse(finishedCommandEvent?.payloadJson || '{}')).toEqual(
      expect.objectContaining({
        sandboxProviderId: 'simulated',
        sandboxProviderKind: 'simulated',
        sandboxExecutionMode: 'simulated',
        sandboxIsolationLevel: 'none',
        sandboxNetworkAccess: 'none',
        sandboxNetworkPolicyMode: 'none',
        sandboxNetworkOutboundAccess: 'none',
        sandboxNetworkAllowedHosts: [],
        sandboxNetworkBlockedByDefault: true,
        ...sandboxCapabilityPayload('demo_only', SIMULATED_CAPABILITY_STATUSES),
        sandboxFilesystemPersistence: 'virtual',
        sandboxCleanupPolicy: 'not_applicable',
        snapshotCount: expect.any(Number),
        persistedSnapshotCount: 0,
        durationMs: expect.any(Number),
        timedOut: false,
        cleanupStatus: 'not_applicable',
        outputTruncated: false,
      }),
    );

    const submitResponse = await request.post(`/api/session/${sessionToken}/submit`);
    expect(submitResponse.ok()).toBeTruthy();
    const submitBody = await submitResponse.json();
    expect(submitBody.completionUrl).toBe(`/session/${sessionToken}/complete`);
    expect(submitBody.reportUrl).toBe(`/dashboard/reports/${session.id}`);

    const completedSession = await db.candidateSession.findUnique({
      where: { id: session.id },
      include: {
        candidate: true,
        evaluationReport: true,
        commandRuns: { include: { testResults: true } },
        aiMessages: true,
      },
    });
    expect(completedSession?.status).toBe('report_ready');
    expect(completedSession?.evaluationReport).toBeTruthy();
    expect(completedSession?.commandRuns[0].testResults).toHaveLength(4);
    expect(completedSession?.aiMessages).toHaveLength(2);

    const reportJson = JSON.parse(completedSession?.evaluationReport?.reportJson || '{}');
    expect(reportJson.rubricVersion).toBe('ai-collaboration-v1');
    expect(reportJson.dimensionScores.map((dimension: { dimension: string }) => dimension.dimension)).toEqual(
      ENTERPRISE_RUBRIC_DIMENSIONS,
    );
    expect(reportJson.scoreBreakdown.map((dimension: { dimension: string }) => dimension.dimension)).toEqual(
      ENTERPRISE_RUBRIC_DIMENSIONS,
    );
    for (const breakdown of reportJson.scoreBreakdown) {
      expect(breakdown).toEqual(
        expect.objectContaining({
          dimension: expect.any(String),
          score: expect.any(Number),
          evidenceSummary: expect.any(String),
          concernSummary: expect.any(String),
          rationale: expect.any(String),
        }),
      );
    }
    for (const dimension of reportJson.dimensionScores) {
      expect(Array.isArray(dimension.evidence)).toBeTruthy();
      expect(dimension.evidence.length).toBeGreaterThan(0);
      expect(Array.isArray(dimension.strengths)).toBeTruthy();
      expect(Array.isArray(dimension.concerns)).toBeTruthy();
      expect(Array.isArray(dimension.followUpQuestions)).toBeTruthy();
      expect(dimension.followUpQuestions.length).toBeGreaterThan(0);
    }
    expect(reportJson.modelMetadata).toEqual({
      evaluator: {
        provider: 'deterministic',
        model: 'deterministic-evidence-ai-collaboration-v1',
        generatedAt: expect.any(String),
      },
      sandbox: {
        providerIds: ['simulated'],
        providerKinds: ['simulated'],
        executionModes: ['simulated'],
        isolationLevels: ['none'],
        readinessStatuses: ['demo_only'],
        capabilityStatuses: {
          realCodeExecution: ['not_supported'],
          productionIsolation: ['not_supported'],
          commandPolicy: ['supported'],
          networkPolicy: ['not_applicable'],
          environmentPolicy: ['not_applicable'],
          resourceLimits: ['not_applicable'],
          workspaceSnapshots: ['supported'],
          cleanupEvidence: ['not_applicable'],
        },
        capabilityGaps: ['productionIsolation', 'realCodeExecution'],
        productionReadyCommandCount: 0,
        nonProductionReadyCommandCount: 1,
        networkAccessModes: ['none'],
        networkPolicyModes: ['none'],
        networkOutboundAccessModes: ['none'],
        networkAllowedHosts: [],
        networkNotBlockedByDefaultCommandCount: 0,
        networkUnrestrictedCommandCount: 0,
        filesystemPersistenceModes: ['virtual'],
        cleanupPolicies: ['not_applicable'],
        commandPolicyModes: ['simulated_allowlist'],
        cleanupStatuses: ['not_applicable'],
        environmentPolicyModes: ['none'],
        exposedEnvKeys: [],
        secretsExposedCommandCount: 0,
        executionTimeoutMsMax: 10_000,
        outputLimitCharsMax: 20_000,
        snapshotFileLimitMax: 200,
        snapshotContentLimitMax: 100_000,
        memoryLimitMbMax: null,
        cpuLimitMsMax: null,
        commandPolicyBlockedCommandCount: 0,
        commandRunsWithMetadata: 1,
        snapshotCount: expect.any(Number),
        persistedSnapshotCount: 0,
        skippedSnapshotCount: 0,
        cleanupFailedCommandCount: 0,
        cleanupRetainedCommandCount: 0,
        timedOutCommandCount: 0,
        outputTruncatedCommandCount: 0,
        outputChunkCount: 2,
        outputStreamKinds: ['stdout', 'system'],
        sandboxRunIds: expect.arrayContaining([expect.stringMatching(SANDBOX_RUN_ID)]),
        workspaceFileCountMax: 5,
        workspaceTotalBytesMax: expect.any(Number),
        workspaceFilePaths: expect.arrayContaining([
          'README.md',
          'src/cart.ts',
          'src/checkout.ts',
          'src/payment.ts',
          'tests/checkout.test.ts',
        ]),
        workspaceDigests: expect.arrayContaining([expect.stringMatching(SHA_256_HEX)]),
        workspaceManifestMismatchCommandCount: 0,
        providerErrorCommandCount: 0,
        invalidWorkspaceFileCommandCount: 0,
        externalProviderUnconfiguredCommandCount: 0,
        totalOutputChars: expect.any(Number),
        totalDurationMs: expect.any(Number),
      },
    });
    expect(reportJson.sandboxSummary).toContain('simulated');
    expect(reportJson.diffSummary).toEqual(
      expect.objectContaining({
        changedFileCount: 1,
        totalAdditions: expect.any(Number),
        totalDeletions: expect.any(Number),
      }),
    );
    expect(reportJson.diffSummary.changedFiles).toEqual([
      expect.objectContaining({ path: 'src/cart.ts' }),
    ]);
    expect(reportJson.diffSummary.checkpoints.map((checkpoint: { type: string }) => checkpoint.type)).toEqual(
      expect.arrayContaining(['file_saved', 'test_run_finished', 'ai_response_received', 'session_ended']),
    );
    expect(reportJson.tokenUsageSummary).toEqual(
      expect.objectContaining({
        promptCount: 1,
        usefulResponses: 1,
        guardrailResponses: 0,
        fallbackResponses: 0,
        totalTokens: expect.any(Number),
      }),
    );
    expect(reportJson.tokenUsageSummary.totalTokens).toBeGreaterThan(0);
    expect(new Date(reportJson.modelMetadata.evaluator.generatedAt).toString()).not.toBe('Invalid Date');
    expect(reportJson.riskFlags).toEqual(expect.arrayContaining(['sandbox_not_production_isolated']));
    expect(reportJson.riskFlags).toEqual(expect.arrayContaining(['sandbox_not_production_ready']));
    expect(reportJson.areasForGrowth).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.any(String),
          detail: expect.any(String),
        }),
      ]),
    );
    expect(reportJson.keyMoments.map((moment: { type: string }) => moment.type)).toEqual([
      'file_saved',
      'test_run_finished',
      'ai_response_received',
      'session_ended',
    ]);
    expect(new Set(reportJson.keyMoments.map((moment: { type: string }) => moment.type)).size).toBe(
      reportJson.keyMoments.length,
    );
    expect(reportJson.keyMoments).toEqual(
      reportJson.keyMoments
        .map((moment: { occurredAt: string }) => moment)
        .sort((a: { occurredAt: string }, b: { occurredAt: string }) => a.occurredAt.localeCompare(b.occurredAt)),
    );
    expect(reportJson.keyMoments.at(-1)).toEqual(
      expect.objectContaining({
        type: 'session_ended',
        title: 'Submitted',
        summary: 'Candidate submitted the assessment',
      }),
    );
    expect(reportJson.activityBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'Coding',
          count: expect.any(Number),
          seconds: expect.any(Number),
          minutes: expect.any(Number),
        }),
        expect.objectContaining({
          category: 'Prompting',
          count: 1,
          seconds: expect.any(Number),
          minutes: expect.any(Number),
        }),
        expect.objectContaining({
          category: 'Debugging',
          count: expect.any(Number),
          seconds: expect.any(Number),
          minutes: expect.any(Number),
        }),
      ]),
    );
    expect(reportJson.promptComplexity).toEqual([
      expect.objectContaining({
        occurredAt: expect.any(String),
        score: expect.any(Number),
        excerpt: expect.stringContaining('failing checkout tests'),
      }),
    ]);
    expect(reportJson.promptComplexity[0].score).toBeGreaterThan(1);
    expect(reportJson.narrativePhases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.stringContaining('Initial'),
          summary: expect.any(String),
          evidenceItems: expect.any(Array),
        }),
        expect.objectContaining({
          title: expect.stringContaining('Implementation'),
          summary: expect.any(String),
          evidenceItems: expect.any(Array),
        }),
        expect.objectContaining({
          title: expect.stringContaining('Submission'),
          summary: expect.any(String),
          evidenceItems: expect.any(Array),
        }),
      ]),
    );

    const authCookie = `hirewave_demo_user=${process.env.DEMO_USER_EMAIL || 'founder@hirewave.local'}`;
    const markdownExport = await request.get(`/api/reports/${session.id}/export?format=markdown`, {
      headers: { Cookie: authCookie },
    });
    expect(markdownExport.ok()).toBeTruthy();
    expect(markdownExport.headers()['content-type']).toContain('text/markdown');
    expect(markdownExport.headers()['content-disposition']).toContain('.md');
    const markdownBody = await markdownExport.text();
    expect(markdownBody).toContain(`# ${completedSession?.candidate.name} Report`);
    expect(markdownBody).toContain('## Score Breakdown');
    expect(markdownBody).toContain('## AI Transcript');
    expect(markdownBody).toContain('## Commands');

    const jsonExport = await request.get(`/api/reports/${session.id}/export?format=json`, {
      headers: { Cookie: authCookie },
    });
    expect(jsonExport.ok()).toBeTruthy();
    expect(jsonExport.headers()['content-type']).toContain('application/json');
    expect(jsonExport.headers()['content-disposition']).toContain('.json');
    const jsonBody = await jsonExport.json();
    expect(jsonBody.report.rubricVersion).toBe('ai-collaboration-v1');
    expect(jsonBody.aiMessages).toHaveLength(2);
    expect(jsonBody.commandRuns[0].command).toBe('npm test');
    expect(jsonBody.diffEvidence.summary.changedFileCount).toBeGreaterThan(0);

    const closedFileResponse = await request.post(`/api/session/${sessionToken}/files`, {
      data: {
        path: 'src/cart.ts',
        language: 'typescript',
        content: `${PASSING_CART_TS}\n// late edit`,
      },
    });
    expect(closedFileResponse.status()).toBe(409);

    const closedCommandResponse = await request.post(`/api/session/${sessionToken}/commands`, {
      data: { command: 'npm test' },
    });
    expect(closedCommandResponse.status()).toBe(409);

    const closedAiResponse = await request.post(`/api/session/${sessionToken}/ai`, {
      data: { message: 'Can I still ask for help?' },
    });
    expect(closedAiResponse.status()).toBe(409);
  });

  test('does not credit first-principles quantity evidence for partial quantity validation', async () => {
    const { session } = await createCandidateSessionFixture({
      name: 'Partial Quantity Candidate',
      email: uniqueTestEmail('partial-quantity'),
    });

    await db.fileSnapshot.createMany({
      data: [
        {
          sessionId: session.id,
          path: 'src/cart.ts',
          language: 'typescript',
          content: PARTIAL_QUANTITY_CART_TS,
          version: 2,
          source: 'candidate',
        },
        {
          sessionId: session.id,
          path: 'src/payment.ts',
          language: 'typescript',
          content: PASSING_PAYMENT_TS,
          version: 2,
          source: 'candidate',
        },
        {
          sessionId: session.id,
          path: 'src/checkout.ts',
          language: 'typescript',
          content: PASSING_CHECKOUT_TS,
          version: 2,
          source: 'candidate',
        },
      ],
    });

    await db.candidateSession.update({
      where: { id: session.id },
      data: { submittedAt: new Date() },
    });

    await generateEvaluationReport(session.id);

    const report = await db.evaluationReport.findUniqueOrThrow({ where: { sessionId: session.id } });
    const reportJson = JSON.parse(report.reportJson);
    const firstPrinciples = reportJson.dimensionScores.find(
      (dimension: { dimension: string }) => dimension.dimension === 'First-Principles Thinking',
    );

    expect(firstPrinciples.score).toBeLessThan(4);
    expect(firstPrinciples.evidence).toContain('No final-file evidence of complete invalid quantity validation was found.');
  });

  test('runs supported simulated terminal commands without executing host shell', async ({ request }) => {
    const { session, sessionToken } = await createCandidateSessionFixture({
      name: 'Terminal Candidate',
      email: uniqueTestEmail('terminal'),
    });

    const lsResponse = await request.post(`/api/session/${sessionToken}/commands`, {
      data: { command: 'ls src' },
    });
    expect(lsResponse.ok()).toBeTruthy();
    const lsBody = await lsResponse.json();
    expect(lsBody.commandRun.exitCode).toBe(0);
    expect(lsBody.commandRun.output).toContain('cart.ts');
    expect(lsBody.commandRun.output).toContain('checkout.ts');

    const catResponse = await request.post(`/api/session/${sessionToken}/commands`, {
      data: { command: 'cat src/cart.ts' },
    });
    expect(catResponse.ok()).toBeTruthy();
    const catBody = await catResponse.json();
    expect(catBody.commandRun.exitCode).toBe(0);
    expect(catBody.commandRun.output).toContain('$ cat src/cart.ts');
    expect(catBody.commandRun.output).toContain('validateCart');
    expect(catBody.commandRun.outputChunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stream: 'system', content: expect.stringContaining('$ cat src/cart.ts') }),
        expect.objectContaining({ stream: 'stdout', content: expect.stringContaining('validateCart') }),
      ]),
    );

    const startEvents = await db.sessionEvent.findMany({
      where: { sessionId: session.id, type: 'command_started' },
      orderBy: { occurredAt: 'asc' },
    });
    const catStartPayload = startEvents
      .map((event) => JSON.parse(event.payloadJson))
      .find((payload) => payload.command === 'cat src/cart.ts');
    expect(catStartPayload).toEqual(
      expect.objectContaining({
        workspaceFileCount: 5,
        workspaceTotalBytes: expect.any(Number),
        workspaceDigest: expect.stringMatching(SHA_256_HEX),
        workspaceFiles: expect.arrayContaining([
          expect.objectContaining({
            path: 'README.md',
            language: 'markdown',
            contentLength: expect.any(Number),
            contentSha256: expect.stringMatching(SHA_256_HEX),
          }),
          expect.objectContaining({
            path: 'src/cart.ts',
            language: 'typescript',
            contentLength: expect.any(Number),
            contentSha256: expect.stringMatching(SHA_256_HEX),
          }),
          expect.objectContaining({
            path: 'tests/checkout.test.ts',
            language: 'typescript',
            contentLength: expect.any(Number),
            contentSha256: expect.stringMatching(SHA_256_HEX),
          }),
        ]),
      }),
    );

    const unsupportedResponse = await request.post(`/api/session/${sessionToken}/commands`, {
      data: { command: 'rm -rf src' },
    });
    expect(unsupportedResponse.ok()).toBeTruthy();
    const unsupportedBody = await unsupportedResponse.json();
    expect(unsupportedBody.commandRun.exitCode).toBe(127);
    expect(unsupportedBody.commandRun.output).toContain('not available in this MVP sandbox');
    expect(unsupportedBody.commandRun.sandbox).toEqual(
      expect.objectContaining({
        execution: expect.objectContaining({
          skippedReason: 'command_not_allowed',
        }),
        commandPolicy: expect.objectContaining({
          mode: 'simulated_allowlist',
          blockedByDefault: true,
        }),
      }),
    );

    await db.candidateSession.update({
      where: { id: session.id },
      data: { submittedAt: new Date() },
    });
    await generateEvaluationReport(session.id);
    const report = await db.evaluationReport.findUniqueOrThrow({ where: { sessionId: session.id } });
    const reportJson = JSON.parse(report.reportJson);
    expect(reportJson.modelMetadata.sandbox.readinessStatuses).toEqual(['demo_only']);
    expect(reportJson.modelMetadata.sandbox.capabilityGaps).toEqual(['productionIsolation', 'realCodeExecution']);
    expect(reportJson.modelMetadata.sandbox.productionReadyCommandCount).toBe(0);
    expect(reportJson.modelMetadata.sandbox.nonProductionReadyCommandCount).toBe(3);
    expect(reportJson.modelMetadata.sandbox.commandPolicyModes).toEqual(['simulated_allowlist']);
    expect(reportJson.modelMetadata.sandbox.commandPolicyBlockedCommandCount).toBe(1);
    expect(reportJson.modelMetadata.sandbox.environmentPolicyModes).toEqual(['none']);
    expect(reportJson.modelMetadata.sandbox.networkPolicyModes).toEqual(['none']);
    expect(reportJson.modelMetadata.sandbox.networkOutboundAccessModes).toEqual(['none']);
    expect(reportJson.modelMetadata.sandbox.networkNotBlockedByDefaultCommandCount).toBe(0);
    expect(reportJson.modelMetadata.sandbox.networkUnrestrictedCommandCount).toBe(0);
    expect(reportJson.modelMetadata.sandbox.secretsExposedCommandCount).toBe(0);
    expect(reportJson.modelMetadata.sandbox.executionTimeoutMsMax).toBe(10_000);
    expect(reportJson.modelMetadata.sandbox.outputLimitCharsMax).toBe(20_000);
    expect(reportJson.modelMetadata.sandbox.snapshotFileLimitMax).toBe(200);
    expect(reportJson.modelMetadata.sandbox.snapshotContentLimitMax).toBe(100_000);
    expect(reportJson.modelMetadata.sandbox.workspaceFileCountMax).toBe(5);
    expect(reportJson.modelMetadata.sandbox.workspaceTotalBytesMax).toBeGreaterThan(0);
    expect(reportJson.modelMetadata.sandbox.workspaceFilePaths).toEqual(
      expect.arrayContaining([
        'README.md',
        'src/cart.ts',
        'src/checkout.ts',
        'src/payment.ts',
        'tests/checkout.test.ts',
      ]),
    );
    expect(reportJson.modelMetadata.sandbox.workspaceDigests).toEqual(
      expect.arrayContaining([expect.stringMatching(SHA_256_HEX)]),
    );
    expect(reportJson.modelMetadata.sandbox.sandboxRunIds).toEqual(
      expect.arrayContaining([expect.stringMatching(SANDBOX_RUN_ID)]),
    );
    expect(reportJson.riskFlags).toEqual(expect.arrayContaining(['sandbox_command_policy_blocked']));
    expect(reportJson.sandboxSummary).toContain('1 command policy block');
  });

  test('caps command output before persisting telemetry and API responses', async ({ request }) => {
    const { session, sessionToken } = await createCandidateSessionFixture({
      name: 'Large Output Candidate',
      email: uniqueTestEmail('large-output'),
    });

    const fileResponse = await request.post(`/api/session/${sessionToken}/files`, {
      data: {
        path: 'logs/large.txt',
        language: 'text',
        content: 'x'.repeat(25_000),
      },
    });
    expect(fileResponse.ok()).toBeTruthy();

    const commandResponse = await request.post(`/api/session/${sessionToken}/commands`, {
      data: { command: 'cat logs/large.txt' },
    });
    expect(commandResponse.ok()).toBeTruthy();
    const body = await commandResponse.json();

    expect(body.commandRun.output).toContain('[output truncated after 20000 chars]');
    expect(body.commandRun.output.length).toBeLessThan(20_100);
    expect(body.commandRun.sandbox.execution).toEqual(
      expect.objectContaining({
        outputChars: expect.any(Number),
        outputLimitChars: 20_000,
        outputTruncated: true,
      }),
    );
    expect(body.commandRun.sandbox.execution.outputChars).toBeGreaterThan(20_000);

    const commandRun = await db.commandRun.findUniqueOrThrow({ where: { id: body.commandRun.id } });
    expect(commandRun.output).toBe(body.commandRun.output);
    expect(commandRun.output.length).toBeLessThan(20_100);

    const outputEvent = await db.sessionEvent.findFirstOrThrow({
      where: { sessionId: session.id, type: 'command_output' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(JSON.parse(outputEvent.payloadJson)).toEqual(
      expect.objectContaining({
        output: body.commandRun.output,
        outputChars: expect.any(Number),
        outputLimitChars: 20_000,
        outputTruncated: true,
        outputChunks: expect.arrayContaining([
          expect.objectContaining({ stream: 'system', content: expect.stringContaining('$ cat logs/large.txt') }),
          expect.objectContaining({ stream: 'stdout' }),
        ]),
      }),
    );
  });

  test('flags unconfigured external sandbox runs in report audit metadata', async () => {
    const { session } = await createCandidateSessionFixture({
      name: 'External Sandbox Candidate',
      email: uniqueTestEmail('external-sandbox'),
    });
    const output = '$ npm test\nExternal sandbox provider e2b is selected but no adapter is configured.';
    const commandRun = await db.commandRun.create({
      data: {
        sessionId: session.id,
        command: 'npm test',
        status: 'failed',
        output,
        exitCode: 126,
        finishedAt: new Date(),
      },
    });

    await db.sessionEvent.create({
      data: {
        sessionId: session.id,
        type: 'test_run_finished',
        actor: 'runner',
        payloadJson: JSON.stringify({
          commandRunId: commandRun.id,
          command: 'npm test',
          exitCode: 126,
          sandboxProviderId: 'e2b',
          sandboxProviderKind: 'external',
          sandboxExecutionMode: 'not_executed',
          sandboxIsolationLevel: 'none',
          sandboxNetworkAccess: 'none',
          sandboxNetworkPolicyMode: 'provider_managed',
          sandboxNetworkOutboundAccess: 'none',
          sandboxNetworkAllowedHosts: [],
          sandboxNetworkBlockedByDefault: true,
          ...sandboxCapabilityPayload('adapter_unconfigured', EXTERNAL_UNCONFIGURED_CAPABILITY_STATUSES),
          sandboxFilesystemPersistence: 'none',
          sandboxCleanupPolicy: 'not_applicable',
          sandboxEnvironmentPolicyMode: 'provider_managed',
          sandboxExposedEnvKeys: [],
          sandboxSecretsExposed: false,
          sandboxResourceLimits: {
            executionTimeoutMs: 10_000,
            outputLimitChars: 20_000,
            snapshotFileLimit: 200,
            snapshotContentLimit: 100_000,
            memoryLimitMb: null,
            cpuLimitMs: null,
          },
          sandboxCommandPolicyMode: 'provider_defined',
          sandboxAllowedCommands: [],
          sandboxBlockedByDefault: true,
          snapshotCount: 0,
          persistedSnapshotCount: 0,
          durationMs: 0,
          timedOut: false,
          cleanupStatus: 'not_applicable',
          outputChars: output.length,
          outputLimitChars: 20_000,
          outputTruncated: false,
          outputChunkCount: 2,
          outputStreamKinds: ['stderr', 'system'],
          skippedReason: 'external_provider_unconfigured',
          passed: 0,
          failed: 0,
          total: 0,
        }),
      },
    });

    await db.candidateSession.update({
      where: { id: session.id },
      data: { submittedAt: new Date() },
    });
    await generateEvaluationReport(session.id);

    const report = await db.evaluationReport.findUniqueOrThrow({ where: { sessionId: session.id } });
    const reportJson = JSON.parse(report.reportJson);
    expect(reportJson.modelMetadata.sandbox.providerKinds).toEqual(['external']);
    expect(reportJson.modelMetadata.sandbox.executionModes).toEqual(['not_executed']);
    expect(reportJson.modelMetadata.sandbox.readinessStatuses).toEqual(['adapter_unconfigured']);
    expect(reportJson.modelMetadata.sandbox.capabilityGaps).toEqual([
      'cleanupEvidence',
      'commandPolicy',
      'environmentPolicy',
      'networkPolicy',
      'productionIsolation',
      'realCodeExecution',
      'resourceLimits',
      'workspaceSnapshots',
    ]);
    expect(reportJson.modelMetadata.sandbox.externalProviderUnconfiguredCommandCount).toBe(1);
    expect(reportJson.riskFlags).toEqual(
      expect.arrayContaining(['sandbox_external_provider_unconfigured', 'sandbox_not_production_ready']),
    );
    expect(reportJson.sandboxSummary).toContain('1 unconfigured external provider');
  });

  test('flags workspace manifest mismatches in report audit metadata', async () => {
    const { session } = await createCandidateSessionFixture({
      name: 'Manifest Mismatch Candidate',
      email: uniqueTestEmail('manifest-mismatch'),
    });
    const output = '$ npm test\nWorkspace manifest did not match mounted files.';
    const commandRun = await db.commandRun.create({
      data: {
        sessionId: session.id,
        command: 'npm test',
        status: 'failed',
        output,
        exitCode: 126,
        finishedAt: new Date(),
      },
    });

    await db.sessionEvent.create({
      data: {
        sessionId: session.id,
        type: 'test_run_finished',
        actor: 'runner',
        payloadJson: JSON.stringify({
          commandRunId: commandRun.id,
          command: 'npm test',
          exitCode: 126,
          sandboxProviderId: 'simulated',
          sandboxProviderKind: 'simulated',
          sandboxExecutionMode: 'simulated',
          sandboxIsolationLevel: 'none',
          sandboxNetworkAccess: 'none',
          sandboxNetworkPolicyMode: 'none',
          sandboxNetworkOutboundAccess: 'none',
          sandboxNetworkAllowedHosts: [],
          sandboxNetworkBlockedByDefault: true,
          ...sandboxCapabilityPayload('demo_only', SIMULATED_CAPABILITY_STATUSES),
          sandboxFilesystemPersistence: 'virtual',
          sandboxCleanupPolicy: 'not_applicable',
          sandboxEnvironmentPolicyMode: 'none',
          sandboxExposedEnvKeys: [],
          sandboxSecretsExposed: false,
          sandboxResourceLimits: {
            executionTimeoutMs: 10_000,
            outputLimitChars: 20_000,
            snapshotFileLimit: 200,
            snapshotContentLimit: 100_000,
            memoryLimitMb: null,
            cpuLimitMs: null,
          },
          sandboxCommandPolicyMode: 'simulated_allowlist',
          sandboxAllowedCommands: ['npm test'],
          sandboxBlockedByDefault: true,
          snapshotCount: 0,
          persistedSnapshotCount: 0,
          durationMs: 0,
          timedOut: false,
          cleanupStatus: 'not_applicable',
          outputChars: output.length,
          outputLimitChars: 20_000,
          outputTruncated: false,
          outputChunkCount: 2,
          outputStreamKinds: ['stderr', 'system'],
          workspaceFileCount: 3,
          workspaceTotalBytes: 100,
          workspaceDigest: 'a'.repeat(64),
          workspaceFiles: [
            {
              path: 'src/cart.ts',
              language: 'typescript',
              contentLength: 100,
              contentSha256: 'b'.repeat(64),
            },
          ],
          skippedReason: 'workspace_manifest_mismatch',
          passed: 0,
          failed: 0,
          total: 0,
        }),
      },
    });

    await db.candidateSession.update({
      where: { id: session.id },
      data: { submittedAt: new Date() },
    });
    await generateEvaluationReport(session.id);

    const report = await db.evaluationReport.findUniqueOrThrow({ where: { sessionId: session.id } });
    const reportJson = JSON.parse(report.reportJson);
    expect(reportJson.modelMetadata.sandbox.workspaceManifestMismatchCommandCount).toBe(1);
    expect(reportJson.riskFlags).toEqual(expect.arrayContaining(['sandbox_workspace_manifest_mismatch']));
    expect(reportJson.sandboxSummary).toContain('1 workspace manifest mismatch');
  });

  test('flags cleanup failures and retained sandbox workspaces in report audit metadata', async () => {
    const { session } = await createCandidateSessionFixture({
      name: 'Cleanup Evidence Candidate',
      email: uniqueTestEmail('cleanup-evidence'),
    });
    const failedCleanupOutput = '$ npm test\nLocal checkout test runner';
    const retainedCleanupOutput = '$ npm test\nLocal checkout test runner';
    const failedCleanupRun = await db.commandRun.create({
      data: {
        sessionId: session.id,
        command: 'npm test',
        status: 'succeeded',
        output: failedCleanupOutput,
        exitCode: 0,
        finishedAt: new Date(),
      },
    });
    const retainedCleanupRun = await db.commandRun.create({
      data: {
        sessionId: session.id,
        command: 'npm test',
        status: 'succeeded',
        output: retainedCleanupOutput,
        exitCode: 0,
        finishedAt: new Date(),
      },
    });

    const localDevPayload = {
      command: 'npm test',
      exitCode: 0,
      sandboxProviderId: 'local-dev',
      sandboxProviderKind: 'local-dev',
      sandboxExecutionMode: 'local_process',
      sandboxIsolationLevel: 'host_temp_directory',
      sandboxNetworkAccess: 'host_inherited',
      sandboxNetworkPolicyMode: 'host_inherited',
      sandboxNetworkOutboundAccess: 'host_inherited',
      sandboxNetworkAllowedHosts: [],
      sandboxNetworkBlockedByDefault: false,
      ...sandboxCapabilityPayload('local_dev_only', LOCAL_DEV_CAPABILITY_STATUSES),
      sandboxFilesystemPersistence: 'ephemeral_temp_directory',
      sandboxCommandPolicyMode: 'exact_allowlist',
      sandboxAllowedCommands: ['npm test'],
      sandboxBlockedByDefault: true,
      sandboxEnvironmentPolicyMode: 'minimal_allowlist',
      sandboxExposedEnvKeys: ['NODE_ENV', 'PATH'],
      sandboxSecretsExposed: false,
      sandboxResourceLimits: {
        executionTimeoutMs: 10_000,
        outputLimitChars: 20_000,
        snapshotFileLimit: 200,
        snapshotContentLimit: 100_000,
        memoryLimitMb: null,
        cpuLimitMs: null,
      },
      snapshotCount: 3,
      persistedSnapshotCount: 0,
      durationMs: 25,
      timedOut: false,
      outputChars: failedCleanupOutput.length,
      outputLimitChars: 20_000,
      outputTruncated: false,
      outputChunkCount: 2,
      outputStreamKinds: ['stdout', 'system'],
      workspaceFileCount: 3,
      workspaceTotalBytes: 100,
      workspaceDigest: 'a'.repeat(64),
      workspaceFiles: [
        {
          path: 'src/cart.ts',
          language: 'typescript',
          contentLength: 100,
          contentSha256: 'b'.repeat(64),
        },
      ],
      passed: 4,
      failed: 0,
      total: 4,
    };

    await db.sessionEvent.createMany({
      data: [
        {
          sessionId: session.id,
          type: 'test_run_finished',
          actor: 'runner',
          payloadJson: JSON.stringify({
            ...localDevPayload,
            commandRunId: failedCleanupRun.id,
            sandboxCleanupPolicy: 'delete_after_run',
            cleanupStatus: 'failed',
            cleanupError: 'rm failed',
          }),
        },
        {
          sessionId: session.id,
          type: 'test_run_finished',
          actor: 'runner',
          payloadJson: JSON.stringify({
            ...localDevPayload,
            commandRunId: retainedCleanupRun.id,
            sandboxCleanupPolicy: 'manual_retention',
            cleanupStatus: 'retained',
            outputChars: retainedCleanupOutput.length,
          }),
        },
      ],
    });

    await db.candidateSession.update({
      where: { id: session.id },
      data: { submittedAt: new Date() },
    });
    await generateEvaluationReport(session.id);

    const report = await db.evaluationReport.findUniqueOrThrow({ where: { sessionId: session.id } });
    const reportJson = JSON.parse(report.reportJson);
    expect(reportJson.modelMetadata.sandbox.cleanupStatuses).toEqual(['failed', 'retained']);
    expect(reportJson.modelMetadata.sandbox.cleanupFailedCommandCount).toBe(1);
    expect(reportJson.modelMetadata.sandbox.cleanupRetainedCommandCount).toBe(1);
    expect(reportJson.modelMetadata.sandbox.readinessStatuses).toEqual(['local_dev_only']);
    expect(reportJson.modelMetadata.sandbox.capabilityGaps).toEqual([
      'networkPolicy',
      'productionIsolation',
      'realCodeExecution',
      'resourceLimits',
    ]);
    expect(reportJson.modelMetadata.sandbox.networkPolicyModes).toEqual(['host_inherited']);
    expect(reportJson.modelMetadata.sandbox.networkOutboundAccessModes).toEqual(['host_inherited']);
    expect(reportJson.modelMetadata.sandbox.networkNotBlockedByDefaultCommandCount).toBe(2);
    expect(reportJson.riskFlags).toEqual(
      expect.arrayContaining(['sandbox_cleanup_failed', 'sandbox_workspace_retained', 'sandbox_network_not_blocked_by_default']),
    );
    expect(reportJson.sandboxSummary).toContain('1 cleanup failure');
    expect(reportJson.sandboxSummary).toContain('1 retained workspace');
    expect(reportJson.sandboxSummary).toContain('2 network policies not blocked by default');
  });

  test('flags unrestricted sandbox network policy in report audit metadata', async () => {
    const { session } = await createCandidateSessionFixture({
      name: 'Unrestricted Network Candidate',
      email: uniqueTestEmail('unrestricted-network'),
    });
    const output = '$ npm test\nProvider reported unrestricted outbound network access.';
    const commandRun = await db.commandRun.create({
      data: {
        sessionId: session.id,
        command: 'npm test',
        status: 'failed',
        output,
        exitCode: 1,
        finishedAt: new Date(),
      },
    });

    await db.sessionEvent.create({
      data: {
        sessionId: session.id,
        type: 'test_run_finished',
        actor: 'runner',
        payloadJson: JSON.stringify({
          commandRunId: commandRun.id,
          command: 'npm test',
          exitCode: 1,
          sandboxProviderId: 'unsafe-provider',
          sandboxProviderKind: 'external',
          sandboxExecutionMode: 'external_process',
          sandboxIsolationLevel: 'external_microvm',
          sandboxNetworkAccess: 'unrestricted',
          sandboxNetworkPolicyMode: 'unrestricted',
          sandboxNetworkOutboundAccess: 'unrestricted',
          sandboxNetworkAllowedHosts: ['*'],
          sandboxNetworkBlockedByDefault: false,
          ...sandboxCapabilityPayload('configured_non_production', CONFIGURED_UNSAFE_EXTERNAL_CAPABILITY_STATUSES),
          sandboxFilesystemPersistence: 'provider_snapshot',
          sandboxCleanupPolicy: 'provider_managed',
          sandboxCommandPolicyMode: 'provider_defined',
          sandboxAllowedCommands: ['npm test'],
          sandboxBlockedByDefault: true,
          sandboxEnvironmentPolicyMode: 'provider_managed',
          sandboxExposedEnvKeys: [],
          sandboxSecretsExposed: false,
          sandboxResourceLimits: {
            executionTimeoutMs: 10_000,
            outputLimitChars: 20_000,
            snapshotFileLimit: 200,
            snapshotContentLimit: 100_000,
            memoryLimitMb: null,
            cpuLimitMs: null,
          },
          snapshotCount: 0,
          persistedSnapshotCount: 0,
          durationMs: 100,
          timedOut: false,
          cleanupStatus: 'provider_managed',
          outputChars: output.length,
          outputLimitChars: 20_000,
          outputTruncated: false,
          outputChunkCount: 2,
          outputStreamKinds: ['stderr', 'system'],
          passed: 0,
          failed: 1,
          total: 1,
        }),
      },
    });

    await db.candidateSession.update({
      where: { id: session.id },
      data: { submittedAt: new Date() },
    });
    await generateEvaluationReport(session.id);

    const report = await db.evaluationReport.findUniqueOrThrow({ where: { sessionId: session.id } });
    const reportJson = JSON.parse(report.reportJson);
    expect(reportJson.modelMetadata.sandbox.networkPolicyModes).toEqual(['unrestricted']);
    expect(reportJson.modelMetadata.sandbox.networkOutboundAccessModes).toEqual(['unrestricted']);
    expect(reportJson.modelMetadata.sandbox.networkAllowedHosts).toEqual(['*']);
    expect(reportJson.modelMetadata.sandbox.networkNotBlockedByDefaultCommandCount).toBe(1);
    expect(reportJson.modelMetadata.sandbox.networkUnrestrictedCommandCount).toBe(1);
    expect(reportJson.modelMetadata.sandbox.readinessStatuses).toEqual(['configured_non_production']);
    expect(reportJson.modelMetadata.sandbox.capabilityGaps).toEqual(['networkPolicy', 'resourceLimits']);
    expect(reportJson.riskFlags).toEqual(
      expect.arrayContaining([
        'sandbox_network_not_blocked_by_default',
        'sandbox_unrestricted_network_access',
        'sandbox_not_production_ready',
      ]),
    );
    expect(reportJson.sandboxSummary).toContain('1 unrestricted network access');
  });

  test('flags sandbox runs that expose server environment secrets', async () => {
    const { session } = await createCandidateSessionFixture({
      name: 'Secret Exposure Candidate',
      email: uniqueTestEmail('secret-exposure'),
    });
    const output = '$ npm test\nProvider reported exposed environment secrets.';
    const commandRun = await db.commandRun.create({
      data: {
        sessionId: session.id,
        command: 'npm test',
        status: 'failed',
        output,
        exitCode: 1,
        finishedAt: new Date(),
      },
    });

    await db.sessionEvent.create({
      data: {
        sessionId: session.id,
        type: 'test_run_finished',
        actor: 'runner',
        payloadJson: JSON.stringify({
          commandRunId: commandRun.id,
          command: 'npm test',
          exitCode: 1,
          sandboxProviderId: 'unsafe-provider',
          sandboxProviderKind: 'external',
          sandboxExecutionMode: 'external_process',
          sandboxIsolationLevel: 'external_microvm',
          sandboxNetworkAccess: 'restricted',
          sandboxNetworkPolicyMode: 'allowlist',
          sandboxNetworkOutboundAccess: 'restricted',
          sandboxNetworkAllowedHosts: ['registry.npmjs.org'],
          sandboxNetworkBlockedByDefault: true,
          ...sandboxCapabilityPayload(
            'configured_non_production',
            CONFIGURED_SECRET_EXPOSING_EXTERNAL_CAPABILITY_STATUSES,
          ),
          sandboxFilesystemPersistence: 'provider_snapshot',
          sandboxCleanupPolicy: 'provider_managed',
          sandboxCommandPolicyMode: 'provider_defined',
          sandboxAllowedCommands: ['npm test'],
          sandboxBlockedByDefault: true,
          sandboxEnvironmentPolicyMode: 'provider_managed',
          sandboxExposedEnvKeys: ['DATABASE_URL'],
          sandboxSecretsExposed: true,
          sandboxResourceLimits: {
            executionTimeoutMs: 10_000,
            outputLimitChars: 20_000,
            snapshotFileLimit: 200,
            snapshotContentLimit: 100_000,
            memoryLimitMb: null,
            cpuLimitMs: null,
          },
          snapshotCount: 0,
          persistedSnapshotCount: 0,
          durationMs: 100,
          timedOut: false,
          cleanupStatus: 'provider_managed',
          outputChars: output.length,
          outputLimitChars: 20_000,
          outputTruncated: false,
          outputChunkCount: 2,
          outputStreamKinds: ['stderr', 'system'],
          passed: 0,
          failed: 1,
          total: 1,
        }),
      },
    });

    await db.candidateSession.update({
      where: { id: session.id },
      data: { submittedAt: new Date() },
    });
    await generateEvaluationReport(session.id);

    const report = await db.evaluationReport.findUniqueOrThrow({ where: { sessionId: session.id } });
    const reportJson = JSON.parse(report.reportJson);
    expect(reportJson.modelMetadata.sandbox.environmentPolicyModes).toEqual(['provider_managed']);
    expect(reportJson.modelMetadata.sandbox.exposedEnvKeys).toEqual(['DATABASE_URL']);
    expect(reportJson.modelMetadata.sandbox.secretsExposedCommandCount).toBe(1);
    expect(reportJson.riskFlags).toEqual(expect.arrayContaining(['sandbox_secrets_exposed']));
    expect(reportJson.sandboxSummary).toContain('1 secret-exposing environment');
  });

  test('separates useful AI responses from guardrails and fallback in scoring and token reporting', async () => {
    const { session } = await createCandidateSessionFixture({
      name: 'AI Caveat Candidate',
      email: uniqueTestEmail('ai-caveat'),
    });

    await db.aiMessage.createMany({
      data: [
        {
          sessionId: session.id,
          role: 'user',
          content: 'How should I debug the failing checkout tests?',
        },
        {
          sessionId: session.id,
          role: 'assistant',
          content: 'Use the runner output to map failures back to files.',
          model: 'minimax-m2.5',
          metadataJson: JSON.stringify({
            provider: 'ollama',
            usage: {
              promptChars: 1200,
              responseChars: 52,
              promptTokens: 310,
              completionTokens: 18,
              totalTokens: 328,
              tokenSource: 'provider',
              includedFiles: ['src/cart.ts'],
            },
            safetyFlags: [],
          }),
        },
        {
          sessionId: session.id,
          role: 'user',
          content: 'hesajdnsddksf',
        },
        {
          sessionId: session.id,
          role: 'assistant',
          content: 'I could not understand that message well enough to give useful help.',
          model: 'input-clarifier-v1',
          metadataJson: JSON.stringify({
            provider: 'guardrail',
            usage: {
              promptChars: 13,
              responseChars: 66,
              promptTokens: 4,
              completionTokens: 17,
              totalTokens: 21,
              tokenSource: 'estimated',
              includedFiles: [],
            },
            safetyFlags: ['low_signal_prompt'],
          }),
        },
        {
          sessionId: session.id,
          role: 'user',
          content: 'Can you review this?',
        },
        {
          sessionId: session.id,
          role: 'assistant',
          content: 'The AI assistant is temporarily unavailable.',
          model: 'provider-error-fallback',
          metadataJson: JSON.stringify({
            provider: 'fallback',
            usage: {
              promptChars: 20,
              responseChars: 46,
              promptTokens: 5,
              completionTokens: 12,
              totalTokens: 17,
              tokenSource: 'estimated',
              includedFiles: ['src/cart.ts'],
            },
            safetyFlags: ['provider_error'],
          }),
        },
      ],
    });

    await db.sessionEvent.createMany({
      data: [
        {
          sessionId: session.id,
          type: 'ai_prompt_sent',
          actor: 'candidate',
          payloadJson: JSON.stringify({ promptLength: 44 }),
        },
        {
          sessionId: session.id,
          type: 'ai_response_received',
          actor: 'ai',
          payloadJson: JSON.stringify({ provider: 'ollama', responseLength: 52, safetyFlags: [] }),
        },
        {
          sessionId: session.id,
          type: 'ai_prompt_sent',
          actor: 'candidate',
          payloadJson: JSON.stringify({ promptLength: 13 }),
        },
        {
          sessionId: session.id,
          type: 'ai_response_received',
          actor: 'ai',
          payloadJson: JSON.stringify({ provider: 'guardrail', responseLength: 66, safetyFlags: ['low_signal_prompt'] }),
        },
        {
          sessionId: session.id,
          type: 'ai_prompt_sent',
          actor: 'candidate',
          payloadJson: JSON.stringify({ promptLength: 20 }),
        },
        {
          sessionId: session.id,
          type: 'ai_response_received',
          actor: 'ai',
          payloadJson: JSON.stringify({ provider: 'fallback', responseLength: 46, safetyFlags: ['provider_error'] }),
        },
      ],
    });

    await db.candidateSession.update({
      where: { id: session.id },
      data: { submittedAt: new Date() },
    });

    await generateEvaluationReport(session.id);

    const report = await db.evaluationReport.findUniqueOrThrow({ where: { sessionId: session.id } });
    const reportJson = JSON.parse(report.reportJson);
    const debuggingWithAi = reportJson.dimensionScores.find(
      (dimension: { dimension: string }) => dimension.dimension === 'Debugging with AI',
    );

    expect(reportJson.tokenUsageSummary).toEqual(
      expect.objectContaining({
        promptCount: 3,
        usefulResponses: 1,
        guardrailResponses: 1,
        fallbackResponses: 1,
        providerTokenResponses: 1,
        totalTokens: 366,
      }),
    );
    expect(reportJson.aiCaveats).toEqual(
      expect.arrayContaining([
        '1 clarification guardrail response occurred.',
        '1 provider fallback response occurred; treat that as platform reliability context, not candidate failure.',
      ]),
    );
    expect(debuggingWithAi.score).toBeLessThan(4);
    expect(debuggingWithAi.evidence).toEqual(
      expect.arrayContaining([
        '1 useful AI response, 1 clarification guardrail, 1 provider fallback',
      ]),
    );
  });

  test('flags broad AI takeover prompts as report overdelegation risk', async () => {
    const { session } = await createCandidateSessionFixture({
      name: 'Overdelegation Candidate',
      email: uniqueTestEmail('overdelegation'),
    });

    await db.aiMessage.createMany({
      data: [
        {
          sessionId: session.id,
          role: 'user',
          content: 'Can you check my entire code and fix all of this for me?',
        },
        {
          sessionId: session.id,
          role: 'assistant',
          content: 'I can help you inspect the work, but you need to own the implementation and verification.',
          model: 'deterministic-evidence-ai-collaboration-v1',
        },
      ],
    });

    await db.sessionEvent.createMany({
      data: [
        {
          sessionId: session.id,
          type: 'ai_prompt_sent',
          actor: 'candidate',
          payloadJson: JSON.stringify({ promptLength: 57 }),
        },
        {
          sessionId: session.id,
          type: 'ai_response_received',
          actor: 'ai',
          payloadJson: JSON.stringify({ provider: 'deterministic', responseLength: 84, safetyFlags: [] }),
        },
      ],
    });

    await db.candidateSession.update({
      where: { id: session.id },
      data: { submittedAt: new Date() },
    });

    await generateEvaluationReport(session.id);

    const report = await db.evaluationReport.findUniqueOrThrow({ where: { sessionId: session.id } });
    const reportJson = JSON.parse(report.reportJson);
    expect(reportJson.riskFlags).toEqual(expect.arrayContaining(['ai_overdelegation_risk']));
    expect(reportJson.aiUsageSummary).toContain('asked the assistant to take over implementation or broad code review');
  });

  test('records invalid workspace file snapshots before sandbox provider execution', async ({ request }) => {
    const originalProvider = process.env.SANDBOX_PROVIDER;
    const originalEnabled = process.env.SANDBOX_LOCAL_DEV_ENABLED;
    const originalAllowed = process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS;
    const originalKeepWorkspace = process.env.SANDBOX_LOCAL_DEV_KEEP_WORKSPACE;
    process.env.SANDBOX_PROVIDER = 'simulated';
    delete process.env.SANDBOX_LOCAL_DEV_ENABLED;
    delete process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS;
    delete process.env.SANDBOX_LOCAL_DEV_KEEP_WORKSPACE;

    try {
      const { session, sessionToken } = await createCandidateSessionFixture({
        name: 'Invalid Workspace Candidate',
        email: uniqueTestEmail('invalid-workspace'),
      });

      await db.fileSnapshot.create({
        data: {
          sessionId: session.id,
          path: '../outside.ts',
          content: 'export const outside = true;',
          language: 'typescript',
          version: 1,
          source: 'candidate',
        },
      });

      const response = await request.post(`/api/session/${sessionToken}/commands`, {
        data: { command: 'npm test' },
      });
      expect(response.ok()).toBeTruthy();
      const body = await response.json();

      expect(body.commandRun.status).toBe('failed');
      expect(body.commandRun.exitCode).toBe(1);
      expect(body.commandRun.output).toContain('Workspace validation failed before sandbox provider execution.');
      expect(body.commandRun.output).toContain('../outside.ts');
      expect(body.commandRun.sandbox).toEqual(
        expect.objectContaining({
          providerId: 'simulated',
          providerKind: 'simulated',
          snapshotCount: 0,
          persistedSnapshotCount: 0,
          execution: expect.objectContaining({
            timedOut: false,
            skippedReason: 'invalid_workspace_file_path',
          }),
        }),
      );

      const commandRun = await db.commandRun.findUniqueOrThrow({ where: { id: body.commandRun.id } });
      expect(commandRun.status).toBe('failed');
      expect(commandRun.finishedAt).toBeTruthy();

      const finishedEvent = await db.sessionEvent.findFirstOrThrow({
        where: { sessionId: session.id, type: 'test_run_finished' },
        orderBy: { occurredAt: 'desc' },
      });
      expect(JSON.parse(finishedEvent.payloadJson)).toEqual(
        expect.objectContaining({
          sandboxProviderId: 'simulated',
          sandboxProviderKind: 'simulated',
          sandboxExecutionMode: 'simulated',
          snapshotCount: 0,
          persistedSnapshotCount: 0,
          skippedReason: 'invalid_workspace_file_path',
          errorMessage: expect.stringContaining('../outside.ts'),
        }),
      );

      await db.candidateSession.update({
        where: { id: session.id },
        data: { submittedAt: new Date() },
      });
      await generateEvaluationReport(session.id);
      const report = await db.evaluationReport.findUniqueOrThrow({ where: { sessionId: session.id } });
      const reportJson = JSON.parse(report.reportJson);
      expect(reportJson.modelMetadata.sandbox.invalidWorkspaceFileCommandCount).toBe(1);
      expect(reportJson.modelMetadata.sandbox.providerErrorCommandCount).toBe(0);
      expect(reportJson.riskFlags).toEqual(expect.arrayContaining(['sandbox_invalid_workspace_file_path']));
      expect(reportJson.sandboxSummary).toContain('1 invalid workspace input');
    } finally {
      if (originalProvider === undefined) delete process.env.SANDBOX_PROVIDER;
      else process.env.SANDBOX_PROVIDER = originalProvider;
      if (originalEnabled === undefined) delete process.env.SANDBOX_LOCAL_DEV_ENABLED;
      else process.env.SANDBOX_LOCAL_DEV_ENABLED = originalEnabled;
      if (originalAllowed === undefined) delete process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS;
      else process.env.SANDBOX_LOCAL_ALLOWED_COMMANDS = originalAllowed;
      if (originalKeepWorkspace === undefined) delete process.env.SANDBOX_LOCAL_DEV_KEEP_WORKSPACE;
      else process.env.SANDBOX_LOCAL_DEV_KEEP_WORKSPACE = originalKeepWorkspace;
    }
  });
});
