import { expect, test } from '@playwright/test';
import { db } from '../../lib/db';
import { generateEvaluationReport } from '../../lib/evaluation/generate-report';
import {
  approveCustomChallengeDraft,
  createCustomChallengeDraft,
  ensureChallengeCatalog,
} from '../../lib/challenge-catalog';
import { validateChallengeDraftFiles } from '../../lib/challenge-builder/validation';
import { tokenHash } from '../../lib/tokens';

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

test.describe('challenge catalog', () => {
  test('seeds a curated catalog beyond the checkout challenge', async () => {
    const challenges = await ensureChallengeCatalog();

    expect(challenges.length).toBeGreaterThanOrEqual(5);
    expect(challenges.map((challenge) => challenge.slug)).toEqual(
      expect.arrayContaining([
        'debug-broken-checkout-flow',
        'real-time-notification-resilient-delivery',
        'robust-activity-log-ingestion-deduplication',
        'personalized-feed-cache-ab-test',
        'webhook-idempotency-order-state',
        'multi-tenant-permission-leak',
        'inventory-reservation-race',
        'csv-import-partial-failure',
        'ai-assistant-guardrail-regression',
      ]),
    );

    for (const challenge of challenges) {
      const persisted = await db.challenge.findUnique({
        where: { slug: challenge.slug },
        include: { files: { orderBy: { sortOrder: 'asc' } } },
      });

      expect(persisted).toBeTruthy();
      expect(persisted?.files.length).toBeGreaterThanOrEqual(3);
      expect(JSON.parse(persisted?.rubricJson || '[]')).toEqual(ENTERPRISE_RUBRIC_DIMENSIONS);
      expect(new Set(persisted?.files.map((file) => file.path)).size).toBe(persisted?.files.length);
      expect(['README.md', 'BRIEF.md']).toContain(persisted?.files[0].path);
    }
  });

  test('seeds complex project-style assessments with brief and starter workspace files', async () => {
    await ensureChallengeCatalog();

    const notification = await db.challenge.findUnique({
      where: { slug: 'real-time-notification-resilient-delivery' },
      include: { files: { orderBy: { sortOrder: 'asc' } } },
    });

    expect(notification).toBeTruthy();
    expect(notification?.durationMinutes).toBe(90);
    expect(notification?.files.length).toBeGreaterThanOrEqual(14);
    expect(notification?.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'BRIEF.md',
        'backend/src/server.ts',
        'backend/src/redis-client.ts',
        'backend/src/rate-limit.ts',
        'backend/src/idempotency.ts',
        'backend/src/models/userProfile.ts',
        'frontend/pages/dashboard.tsx',
        'frontend/components/NotificationDisplay.tsx',
        'frontend/utils/websocket.ts',
        'tests/notification-system.test.ts',
      ]),
    );
    expect(notification?.instructions).toContain('Redis Pub/Sub');
    expect(notification?.instructions).toContain('duplicate WebSocket');

    const activityLog = await db.challenge.findUnique({
      where: { slug: 'robust-activity-log-ingestion-deduplication' },
      include: { files: true },
    });
    const feed = await db.challenge.findUnique({
      where: { slug: 'personalized-feed-cache-ab-test' },
      include: { files: true },
    });

    expect(activityLog?.durationMinutes).toBe(90);
    expect(activityLog?.instructions).toContain('deduplication');
    expect(JSON.parse(activityLog?.stackJson || '[]')).toEqual(
      expect.arrayContaining(['TypeScript', 'Node.js', 'PostgreSQL', 'Queue workers', 'Testing']),
    );
    expect(activityLog?.files.length).toBeGreaterThanOrEqual(8);
    expect(activityLog?.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'BRIEF.md',
        'src/solution-plan.ts',
        'backend/src/service.ts',
        'backend/src/repository.ts',
        'tests/project-slice.test.ts',
      ]),
    );

    expect(feed?.durationMinutes).toBe(90);
    expect(feed?.instructions).toContain('A/B');
    expect(JSON.parse(feed?.stackJson || '[]')).toEqual(
      expect.arrayContaining(['Next.js', 'TypeScript', 'Redis', 'Experimentation', 'Testing']),
    );
    expect(feed?.files.length).toBeGreaterThanOrEqual(8);
    expect(feed?.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'BRIEF.md',
        'src/solution-plan.ts',
        'backend/src/service.ts',
        'frontend/components/ReviewPanel.tsx',
        'tests/project-slice.test.ts',
      ]),
    );
  });

  test('creates a deterministic custom task draft from interviewer inputs', async () => {
    const draft = await createCustomChallengeDraft({
      title: `Webhook Retry Draft ${Date.now()}`,
      role: 'Backend Engineer',
      seniority: 'Senior',
      taskType: 'Bug fix',
      domain: 'Payments',
      durationMinutes: 90,
      stack: ['TypeScript', 'Node.js', 'Prisma', 'Testing'],
      failureMode: 'Duplicate webhook events',
      focusSkills: ['Debugging', 'API design', 'Database reasoning'],
      context: 'The payment provider retries succeeded webhooks and some orders are confirmed twice.',
    });

    const persisted = await db.challenge.findUnique({
      where: { id: draft.id },
      include: { files: { orderBy: { sortOrder: 'asc' } } },
    });

    expect(persisted).toBeTruthy();
    expect(persisted?.slug).toMatch(/^custom-/);
    expect(persisted?.difficulty).toBe('Draft - Senior');
    expect(persisted?.scenario).toContain('Payments');
    expect(persisted?.instructions).toContain('Duplicate webhook events');
    expect(JSON.parse(persisted?.stackJson || '[]')).toEqual(['TypeScript', 'Node.js', 'Prisma', 'Testing']);
    expect(JSON.parse(persisted?.rubricJson || '[]')).toEqual(ENTERPRISE_RUBRIC_DIMENSIONS);
    expect(persisted?.files.map((file) => file.path)).toEqual([
      'README.md',
      'src/problem-context.ts',
      'src/solution-plan.ts',
      'tests/custom-task.test.ts',
    ]);

    const validation = validateChallengeDraftFiles(persisted?.files || []);
    expect(validation.status).toBe('review_ready');
    expect(validation.allowedCommands).toContain('npm test');
    expect(validation.evidenceChecklist.join(' ')).toContain('Candidate-facing brief');
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'warning',
          code: 'starter_todos',
        }),
      ]),
    );
  });

  test('blocks unsafe custom draft files during validation', () => {
    const validation = validateChallengeDraftFiles([
      {
        path: '../secret.ts',
        language: 'typescript',
        content: 'export const API_KEY = "sk_test_123456789";',
      },
      {
        path: 'README.md',
        language: 'markdown',
        content: '# Unsafe draft with enough text for a candidate brief',
      },
      {
        path: 'tests/custom-task.test.ts',
        language: 'typescript',
        content: 'describe("custom task", () => {});',
      },
    ]);

    expect(validation.status).toBe('blocked');
    expect(validation.errorCount).toBeGreaterThanOrEqual(2);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', code: 'unsafe_path' }),
        expect.objectContaining({ severity: 'error', code: 'possible_secret' }),
      ]),
    );
  });

  test('approves custom drafts only after validation passes', async () => {
    const draft = await createCustomChallengeDraft({
      title: `Approval Draft ${Date.now()}`,
      role: 'Backend Engineer',
      seniority: 'Senior',
      taskType: 'Reliability incident',
      domain: 'Realtime',
      durationMinutes: 90,
      stack: ['TypeScript', 'Node.js', 'Testing'],
      failureMode: 'Stale websocket presence',
      focusSkills: ['Debugging', 'System design'],
      context: 'Presence events can stay active after a client disconnects during network churn.',
    });

    expect(draft.difficulty).toBe('Draft - Senior');

    const approved = await approveCustomChallengeDraft(draft.id);
    expect(approved.difficulty).toBe('Custom - Senior');
    expect(approved.slug).toBe(draft.slug);
    expect(approved.instructions).toContain('Approval gate');
    expect(approved.instructions).toContain('Allowed commands:');
  });

  test('generates non-checkout report language for custom challenge sessions', async () => {
    const draft = await createCustomChallengeDraft({
      title: `Permission Draft ${Date.now()}`,
      role: 'Full-stack Engineer',
      seniority: 'Senior',
      taskType: 'Bug fix',
      domain: 'SaaS authorization',
      durationMinutes: 75,
      stack: ['Next.js', 'TypeScript', 'Authorization', 'Testing'],
      failureMode: 'Permission leak',
      focusSkills: ['Debugging', 'Authorization boundaries'],
      context: 'A manager can open another workspace report by changing an ID in the URL.',
    });
    const workspace = await db.workspace.findFirstOrThrow();
    const user = await db.user.findFirstOrThrow();
    const assessment = await db.assessment.create({
      data: {
        workspaceId: workspace.id,
        challengeId: draft.id,
        createdById: user.id,
        title: 'Custom authorization assessment',
        role: 'Full-stack Engineer',
        seniority: 'Senior',
        durationMinutes: 75,
        aiMode: 'allowed',
        allowedToolsJson: JSON.stringify(['Hirewave AI assistant', 'Terminal', 'Test runner', 'File editor']),
        rubricJson: draft.rubricJson,
        status: 'active',
      },
    });
    const candidate = await db.candidate.create({
      data: {
        workspaceId: workspace.id,
        name: 'Custom Report Candidate',
        email: `custom.report.${Date.now()}@example.com`,
      },
    });
    const session = await db.candidateSession.create({
      data: {
        assessmentId: assessment.id,
        candidateId: candidate.id,
        sessionTokenHash: tokenHash(`custom_report_${Date.now()}`),
        status: 'submitted',
        startedAt: new Date(Date.now() - 10 * 60 * 1000),
        submittedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const files = await db.challengeFile.findMany({ where: { challengeId: draft.id } });
    await db.fileSnapshot.createMany({
      data: files.map((file) => ({
        sessionId: session.id,
        path: file.path,
        language: file.language,
        version: 1,
        source: 'starter',
        content: file.path === 'src/solution-plan.ts'
          ? `export const rootCause = 'The first unsafe behavior is the report detail query missing workspace scope.';

export const riskControls = [
  'Scope report detail reads by workspace and report id.',
  'Return a neutral not-found response for cross-workspace access.',
];

export const verificationEvidence = [
  'Same-workspace access passes and cross-workspace report access is blocked.',
];
`
          : file.content,
      })),
    });
    const commandRun = await db.commandRun.create({
      data: {
        sessionId: session.id,
        command: 'npm test',
        status: 'succeeded',
        output: 'Simulated custom task runner\n\nResult: 4/4 passed',
        exitCode: 0,
        finishedAt: new Date(),
      },
    });
    await db.testResult.createMany({
      data: [
        'keeps a candidate-facing task brief',
        'documents a concrete root cause',
        'records at least two risk controls',
        'records verification evidence',
      ].map((name) => ({
        commandRunId: commandRun.id,
        sessionId: session.id,
        name,
        status: 'passed',
      })),
    });
    await db.aiMessage.createMany({
      data: [
        {
          sessionId: session.id,
          role: 'user',
          content: 'How should I verify the authorization boundary and root cause evidence?',
        },
        {
          sessionId: session.id,
          role: 'assistant',
          content: 'Tie the changed report read to workspace scope, then cite same-workspace and cross-workspace checks.',
          model: 'deterministic-evidence-ai-collaboration-v1',
          metadataJson: JSON.stringify({
            provider: 'deterministic',
            usage: {
              promptTokens: 18,
              completionTokens: 24,
              totalTokens: 42,
              tokenSource: 'estimated',
            },
            safetyFlags: [],
          }),
        },
      ],
    });

    const report = await generateEvaluationReport(session.id);
    const reportJson = JSON.parse(report.reportJson);
    const customReportText = [
      report.summary,
      reportJson.codeQualitySummary,
      reportJson.areasForGrowth.map((item: { title: string; detail: string }) => `${item.title} ${item.detail}`).join(' '),
      reportJson.keyMoments.map((moment: { title: string; summary: string }) => `${moment.title} ${moment.summary}`).join(' '),
      reportJson.narrativePhases
        .map((phase: { title: string; summary: string; evidenceItems: string[] }) =>
          `${phase.title} ${phase.summary} ${phase.evidenceItems.join(' ')}`,
        )
        .join(' '),
    ].join(' ').toLowerCase();

    expect(customReportText).not.toContain('checkout');
    expect(reportJson.scoreBreakdown.map((item: { dimension: string }) => item.dimension)).toEqual(JSON.parse(draft.rubricJson));
    expect(reportJson.nextInterviewFocus.join(' ')).toContain('root cause');
    expect(reportJson.keyMoments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'test_run_finished',
          title: 'Test run finished',
          occurredAt: expect.any(String),
          summary: expect.stringContaining('npm test passed'),
        }),
        expect.objectContaining({
          type: 'ai_response_received',
          title: 'AI response received',
          occurredAt: expect.any(String),
          summary: expect.stringContaining('AI response captured'),
        }),
      ]),
    );
    expect(reportJson.activityBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'Planning',
          count: expect.any(Number),
          seconds: expect.any(Number),
          minutes: expect.any(Number),
        }),
        expect.objectContaining({
          category: 'Debugging',
          count: 1,
          seconds: expect.any(Number),
          minutes: expect.any(Number),
        }),
        expect.objectContaining({
          category: 'Prompting',
          count: 1,
          seconds: expect.any(Number),
          minutes: expect.any(Number),
        }),
      ]),
    );
    expect(reportJson.promptComplexity).toEqual([
      expect.objectContaining({
        occurredAt: expect.any(String),
        score: expect.any(Number),
        excerpt: expect.stringContaining('authorization boundary'),
      }),
    ]);
    expect(reportJson.promptComplexity[0].score).toBeGreaterThan(1);
    expect(reportJson.narrativePhases).toEqual([
      expect.objectContaining({
        title: expect.stringContaining('Initial'),
        timeRange: expect.any(String),
        summary: expect.any(String),
        evidenceItems: expect.any(Array),
      }),
      expect.objectContaining({
        title: expect.stringContaining('Implementation'),
        timeRange: expect.any(String),
        summary: expect.any(String),
        evidenceItems: expect.any(Array),
      }),
      expect.objectContaining({
        title: expect.stringContaining('Submission'),
        timestamp: expect.any(String),
        summary: expect.any(String),
        evidenceItems: expect.any(Array),
      }),
    ]);
  });
});
