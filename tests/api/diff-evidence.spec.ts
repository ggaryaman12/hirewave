import { expect, test } from '@playwright/test';
import { db } from '../../lib/db';
import {
  PASSING_CART_TS,
  PASSING_CHECKOUT_TS,
  PASSING_PAYMENT_TS,
  createCandidateSessionFixture,
  uniqueTestEmail,
} from '../helpers/session-fixtures';
import { buildFileDiff } from '../../lib/diff/text-diff';
import { getSessionDiffEvidence } from '../../lib/diff/session-diff';
import { logSessionEvent } from '../../lib/telemetry';

test.describe('diff evidence', () => {
  test('builds split diff rows from starter code to candidate code', async () => {
    const { assessment } = await createCandidateSessionFixture({
      name: 'Diff Helper Candidate',
      email: uniqueTestEmail('diff-helper'),
    });
    const starterCart = assessment.challenge.files.find((file) => file.path === 'src/cart.ts');
    expect(starterCart).toBeTruthy();

    const diff = buildFileDiff({
      path: 'src/cart.ts',
      language: 'typescript',
      originalContent: starterCart?.content || '',
      currentContent: PASSING_CART_TS,
    });

    expect(diff.changed).toBeTruthy();
    expect(diff.additions).toBeGreaterThan(0);
    expect(diff.deletions).toBeGreaterThan(0);
    expect(diff.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'removed',
          oldContent: "    if (item.quantity === undefined) {",
          newContent: '',
        }),
        expect.objectContaining({
          kind: 'added',
          oldContent: '',
          newContent: '    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {',
        }),
      ]),
    );
  });

  test('summarizes final diffs and important checkpoint timeline from session evidence', async () => {
    const { session } = await createCandidateSessionFixture({
      name: 'Checkpoint Diff Candidate',
      email: uniqueTestEmail('checkpoint-diff'),
    });

    await logSessionEvent({
      sessionId: session.id,
      type: 'session_started',
      actor: 'system',
      payload: { durationMinutes: 60 },
    });

    await db.fileSnapshot.createMany({
      data: [
        {
          sessionId: session.id,
          path: 'src/cart.ts',
          language: 'typescript',
          content: PASSING_CART_TS,
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

    await logSessionEvent({
      sessionId: session.id,
      type: 'file_saved',
      actor: 'candidate',
      payload: { path: 'src/cart.ts', version: 2 },
    });

    const command = await db.commandRun.create({
      data: {
        sessionId: session.id,
        command: 'npm test',
        status: 'succeeded',
        output: 'Result: 4/4 passed',
        exitCode: 0,
        finishedAt: new Date(),
      },
    });

    await logSessionEvent({
      sessionId: session.id,
      type: 'test_run_finished',
      actor: 'runner',
      payload: {
        commandRunId: command.id,
        command: 'npm test',
        exitCode: 0,
        passed: 4,
        failed: 0,
        total: 4,
      },
    });

    await db.aiMessage.createMany({
      data: [
        {
          sessionId: session.id,
          role: 'user',
          content: 'Review my checkout rollback fix',
        },
        {
          sessionId: session.id,
          role: 'assistant',
          content: 'Verify rollback with tests and inspect payment error handling.',
          model: 'deterministic-hirewave-mvp',
        },
      ],
    });

    await logSessionEvent({
      sessionId: session.id,
      type: 'ai_response_received',
      actor: 'ai',
      payload: { responseLength: 58, provider: 'deterministic' },
    });

    await logSessionEvent({
      sessionId: session.id,
      type: 'session_ended',
      actor: 'system',
      payload: { reason: 'candidate_submitted' },
    });

    const evidence = await getSessionDiffEvidence(session.id);

    expect(evidence.summary.changedFileCount).toBe(3);
    expect(evidence.summary.totalAdditions).toBeGreaterThan(0);
    expect(evidence.summary.totalDeletions).toBeGreaterThan(0);
    expect(evidence.changedFiles.map((file) => file.path)).toEqual([
      'src/cart.ts',
      'src/checkout.ts',
      'src/payment.ts',
    ]);
    expect(evidence.changedFiles[0].rows.some((row) => row.kind !== 'unchanged')).toBeTruthy();
    expect(evidence.checkpoints.map((checkpoint) => checkpoint.type)).toEqual(
      expect.arrayContaining([
        'session_started',
        'file_saved',
        'test_run_finished',
        'ai_response_received',
        'session_ended',
      ]),
    );
    expect(evidence.checkpoints.find((checkpoint) => checkpoint.type === 'file_saved')).toEqual(
      expect.objectContaining({
        filePath: 'src/cart.ts',
        summary: expect.stringContaining('src/cart.ts'),
      }),
    );
    expect(evidence.checkpoints.find((checkpoint) => checkpoint.type === 'test_run_finished')).toEqual(
      expect.objectContaining({
        summary: expect.stringContaining('4/4 tests passed'),
      }),
    );
  });
});
