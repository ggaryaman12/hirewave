import { db } from '@/lib/db';
import { parseJson, toJson } from '@/lib/json';
import { getLatestFiles } from '@/lib/sessions';

// Separate, versioned rubric for agent-delegation assessments. ai-collaboration-v1
// is intentionally left unchanged (AGENTS.md: new rubric version, not a rewrite).
const RUBRIC_VERSION = 'ai-delegation-v1';
const EVALUATOR_MODEL = 'deterministic-evidence-ai-delegation-v1';

const DIMENSIONS = [
  'Task Specification',
  'Agent Steering',
  'Diff Review Rigor',
  'Verification',
  'Correction & Override',
  'Delegation Efficiency',
] as const;

type DimensionReport = {
  dimension: string;
  score: number;
  evidence: string[];
  strengths: string[];
  concerns: string[];
  followUpQuestions: string[];
};

function clampScore(value: number) {
  return Math.max(1, Math.min(5, value));
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return count === 1 ? singular : pluralLabel;
}

function compactText(value: string, maxLength = 220) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function promptSpecificityScore(content: string) {
  const normalized = content.toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  const technicalSignals = ['test', 'fail', 'error', 'because', 'file', 'function', 'edge', 'case', 'verify', 'expected', 'rollback', 'validation'];
  const specific = technicalSignals.filter((signal) => normalized.includes(signal)).length;
  const vagueAsk = /^(fix (it|all|everything)|do it|make it work|help)\??$/.test(normalized.trim()) ? 1 : 0;
  return clampScore(1 + Math.min(2, specific) + (words.length >= 10 ? 1 : 0) + (words.length >= 25 ? 1 : 0) - vagueAsk);
}

export async function generateAgentDelegationReport(sessionId: string) {
  const session = await db.candidateSession.findUnique({
    where: { id: sessionId },
    include: {
      candidate: true,
      assessment: { include: { challenge: true } },
      events: { orderBy: { occurredAt: 'asc' } },
      aiMessages: { orderBy: { createdAt: 'asc' } },
      commandRuns: { orderBy: { startedAt: 'asc' }, include: { testResults: true } },
      agentProposals: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!session) throw new Error('Session not found');

  const files = await getLatestFiles(session.id);
  const events = session.events.map((event) => ({ ...event, payload: parseJson<Record<string, unknown>>(event.payloadJson, {}) }));

  const userPrompts = session.aiMessages.filter((message) => message.role === 'user');
  const promptCount = userPrompts.length;
  const avgSpecificity = promptCount
    ? userPrompts.reduce((sum, message) => sum + promptSpecificityScore(message.content), 0) / promptCount
    : 0;

  const proposals = session.agentProposals;
  const approved = proposals.filter((proposal) => proposal.status === 'approved');
  const rejected = proposals.filter((proposal) => proposal.status === 'rejected');
  const decisions = approved.length + rejected.length;
  const rejectionsWithReason = rejected.filter((proposal) => (proposal.decisionReason || '').trim().length > 0).length;
  const reviewedRatio = proposals.length ? decisions / proposals.length : 0;

  const testRuns = session.commandRuns.filter((run) => run.command.includes('test'));
  const lastTest = testRuns[testRuns.length - 1];
  const finalPassed = lastTest?.exitCode === 0;
  const agentCommandCount = events.filter((event) => event.type === 'ai_agent_command_run').length;
  const candidateEdits = files.filter((file) => false).length; // candidate-authored edits are tracked via snapshot source below
  const candidateSnapshotEdits = await db.fileSnapshot.count({ where: { sessionId: session.id, source: 'candidate' } });
  const agentSnapshotEdits = await db.fileSnapshot.count({ where: { sessionId: session.id, source: 'ai_agent' } });
  void candidateEdits;

  const evidence = {
    prompts: `${promptCount} agent ${plural(promptCount, 'instruction')} sent (avg specificity ${avgSpecificity.toFixed(1)}/5)`,
    proposals: `${proposals.length} edit ${plural(proposals.length, 'proposal')}: ${approved.length} approved, ${rejected.length} rejected, ${proposals.length - decisions} pending`,
    review: `${Math.round(reviewedRatio * 100)}% of proposals reviewed; ${rejectionsWithReason} rejection${rejectionsWithReason === 1 ? '' : 's'} included a reason`,
    commands: `${agentCommandCount} agent command run${agentCommandCount === 1 ? '' : 's'}`,
    tests: testRuns.length ? `${testRuns.length} test run${testRuns.length === 1 ? '' : 's'}; final run ${finalPassed ? 'passed' : 'did not pass'}` : 'No test runs captured',
    attribution: `${agentSnapshotEdits} agent-applied file ${plural(agentSnapshotEdits, 'edit')}, ${candidateSnapshotEdits} candidate-authored ${plural(candidateSnapshotEdits, 'edit')}`,
  };

  const dimensionReports: DimensionReport[] = DIMENSIONS.map((dimension) => {
    switch (dimension) {
      case 'Task Specification':
        return {
          dimension,
          score: clampScore(avgSpecificity >= 4 && promptCount >= 2 ? 4 : promptCount ? 3 : 2),
          evidence: [evidence.prompts],
          strengths: avgSpecificity >= 3.5 ? ['Instructions carried concrete context and constraints.'] : ['Instructions were broad; specificity was limited.'],
          concerns: avgSpecificity < 3 ? ['Vague delegation makes it hard to judge intent; inspect prompt quality.'] : ['Confirm the candidate scoped tasks rather than dumping the whole problem on the agent.'],
          followUpQuestions: ['How did you decide what to delegate and what to specify explicitly?'],
        };
      case 'Agent Steering':
        return {
          dimension,
          score: clampScore(promptCount >= 3 ? 4 : promptCount >= 2 ? 3 : 2),
          evidence: [evidence.prompts, evidence.proposals],
          strengths: promptCount >= 2 ? ['Iterated with the agent across multiple turns.'] : ['Little back-and-forth; limited steering evidence.'],
          concerns: ['Check whether follow-ups redirected the agent or merely repeated the ask.'],
          followUpQuestions: ['Walk through a moment you redirected the agent and why.'],
        };
      case 'Diff Review Rigor':
        return {
          dimension,
          score: clampScore(
            decisions === 0 ? 2 : reviewedRatio >= 0.8 ? (rejected.length > 0 ? 4 : 3) : 2,
          ),
          evidence: [evidence.review, evidence.attribution],
          strengths: rejected.length > 0 ? ['Rejected at least one proposed edit, showing active review.'] : ['No rejections captured; review rigor is unproven.'],
          concerns:
            approved.length > 0 && rejected.length === 0 && !testRuns.length
              ? ['Approved edits with no rejections and no test verification — possible rubber-stamping.']
              : ['Confirm the candidate read each diff before approving.'],
          followUpQuestions: ['Which proposed change did you scrutinize most, and what did you check?'],
        };
      case 'Verification':
        return {
          dimension,
          score: clampScore(finalPassed && testRuns.length ? 4 : testRuns.length ? 3 : 2),
          evidence: [evidence.tests, evidence.commands],
          strengths: testRuns.length ? ['Used the runner to verify agent output.'] : ['No test verification of agent output was captured.'],
          concerns: finalPassed ? ['Simulated runner is a narrow proof; discuss production verification.'] : ['Agent output was not proven by a passing runner.'],
          followUpQuestions: ['How did you confirm the agent’s edits actually worked?'],
        };
      case 'Correction & Override':
        return {
          dimension,
          score: clampScore(rejectionsWithReason >= 1 ? 4 : rejected.length ? 3 : 2),
          evidence: [evidence.review],
          strengths: rejectionsWithReason ? ['Rejected weak proposals with explicit reasons.'] : ['No reasoned overrides captured.'],
          concerns: ['Assess whether overrides reflected real understanding versus guesswork.'],
          followUpQuestions: ['Describe a proposal you overrode and the better approach you wanted.'],
        };
      case 'Delegation Efficiency':
      default:
        return {
          dimension,
          score: clampScore(approved.length > 0 && proposals.length <= Math.max(2, approved.length * 2) ? (finalPassed ? 4 : 3) : proposals.length ? 3 : 2),
          evidence: [evidence.proposals, evidence.prompts],
          strengths: approved.length && proposals.length <= approved.length * 2 ? ['Reached accepted edits without excessive churn.'] : ['Proposal-to-acceptance ratio suggests churn; review efficiency.'],
          concerns: ['Low churn alone is not mastery; inspect whether prompts were efficient and well-targeted.'],
          followUpQuestions: ['What would you change to reach a correct solution in fewer agent round-trips?'],
        };
    }
  });

  const overallScore = Number((dimensionReports.reduce((sum, dimension) => sum + dimension.score, 0) / dimensionReports.length).toFixed(1));
  const overallRecommendation =
    overallScore >= 4.5 ? 'strong_yes' : overallScore >= 3.8 ? 'yes' : overallScore >= 3 ? 'maybe' : overallScore >= 2 ? 'no' : 'strong_no';

  const riskFlags = [
    ...(proposals.length === 0 ? ['agent_no_proposals'] : []),
    ...(approved.length > 0 && rejected.length === 0 && !testRuns.length ? ['blanket_approval_risk'] : []),
    ...(!testRuns.length ? ['no_verification'] : []),
    ...(!finalPassed && testRuns.length ? ['final_tests_not_passing'] : []),
    ...(agentSnapshotEdits > 0 && candidateSnapshotEdits === 0 ? ['fully_agent_authored'] : []),
  ];

  const scoreBreakdown = dimensionReports.map((dimension) => ({
    dimension: dimension.dimension,
    score: dimension.score,
    evidenceSummary: compactText(dimension.evidence.join(' '), 260),
    concernSummary: compactText(dimension.concerns.join(' '), 260),
    rationale: compactText([...dimension.strengths, ...dimension.concerns].join(' '), 260),
  }));

  const weakest = [...dimensionReports].sort((a, b) => a.score - b.score || a.dimension.localeCompare(b.dimension)).slice(0, 3);
  const areasForGrowth = weakest.map((dimension) => ({
    title: dimension.dimension,
    detail: compactText(dimension.concerns[0] || dimension.followUpQuestions[0] || 'Review with the candidate.', 220),
  }));

  const summary = `${session.candidate.name} worked in agent mode: ${proposals.length} proposed ${plural(proposals.length, 'edit')} (${approved.length} approved, ${rejected.length} rejected), ${promptCount} agent ${plural(promptCount, 'instruction')}, and ${testRuns.length ? (finalPassed ? 'a passing final test run' : 'tests that did not finally pass') : 'no test verification'}.`;

  const reportJson = {
    rubricVersion: RUBRIC_VERSION,
    mode: 'agent',
    modelMetadata: {
      evaluator: { provider: 'deterministic', model: EVALUATOR_MODEL, generatedAt: new Date().toISOString() },
    },
    overallRecommendation,
    overallScore,
    summary,
    dimensionScores: dimensionReports,
    scoreBreakdown,
    areasForGrowth,
    keyMoments: proposals.slice(0, 8).map((proposal) => ({
      type: 'agent_edit_proposed',
      title: `Proposed edit: ${proposal.path}`,
      occurredAt: proposal.createdAt.toISOString(),
      summary: `${proposal.status}${proposal.decisionReason ? ` — ${compactText(proposal.decisionReason, 120)}` : ''}`,
      ...(proposal.status === 'rejected' ? { severity: 'info' } : {}),
    })),
    activityBreakdown: [
      ...(promptCount ? [{ category: 'Steering', count: promptCount, seconds: 0, minutes: 0 }] : []),
      ...(proposals.length ? [{ category: 'Reviewing', count: proposals.length, seconds: 0, minutes: 0 }] : []),
      ...(testRuns.length ? [{ category: 'Verifying', count: testRuns.length, seconds: 0, minutes: 0 }] : []),
    ],
    promptComplexity: userPrompts.map((message) => ({
      occurredAt: message.createdAt.toISOString(),
      score: promptSpecificityScore(message.content),
      excerpt: compactText(message.content, 140),
    })),
    narrativePhases: [
      {
        title: 'Delegation & Review',
        summary,
        evidenceItems: [evidence.prompts, evidence.proposals, evidence.review, evidence.tests, evidence.attribution],
      },
    ],
    timelineSummary: `${evidence.prompts}. ${evidence.proposals}. ${evidence.review}. ${evidence.tests}. ${evidence.attribution}.`,
    codeQualitySummary: finalPassed
      ? 'Agent-assisted changes satisfied the simulated runner. Reviewer should confirm the candidate understood the approved edits.'
      : 'Final code needs human review; the captured runner did not show a clean final pass.',
    aiUsageSummary: `Agent mode: ${evidence.proposals}; ${evidence.review}; ${evidence.attribution}.`,
    riskFlags,
    nextInterviewFocus: [
      'Ask the candidate to explain an approved edit line by line.',
      'Probe how they decided to reject or override a proposal.',
      'Discuss how they verified the agent’s changes beyond the simulated runner.',
    ],
    tokenUsageSummary: { promptCount, responseCount: session.aiMessages.filter((m) => m.role === 'assistant').length },
    diffSummary: { changedFileCount: agentSnapshotEdits + candidateSnapshotEdits, totalAdditions: 0, totalDeletions: 0, changedFiles: [], checkpoints: [] },
  };

  const saved = await db.evaluationReport.upsert({
    where: { sessionId: session.id },
    update: { overallRecommendation, overallScore, summary, reportJson: toJson(reportJson), generatedBy: EVALUATOR_MODEL },
    create: { sessionId: session.id, overallRecommendation, overallScore, summary, reportJson: toJson(reportJson), generatedBy: EVALUATOR_MODEL },
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

  await db.candidateSession.update({ where: { id: session.id }, data: { status: 'report_ready' } });

  return saved;
}
