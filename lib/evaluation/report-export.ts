import { db } from '@/lib/db';
import { getSessionDiffEvidence } from '@/lib/diff/session-diff';
import { parseJson } from '@/lib/json';

type ExportFormat = 'json' | 'markdown';

type ReportExportInput = {
  sessionId: string;
  workspaceId: string;
  format: ExportFormat;
};

type ReportJsonShape = {
  rubricVersion?: string;
  overallRecommendation?: string;
  overallScore?: number;
  summary?: string;
  dimensionScores?: Array<{
    dimension?: string;
    score?: number;
    evidence?: string[];
    strengths?: string[];
    concerns?: string[];
    followUpQuestions?: string[];
  }>;
  areasForGrowth?: Array<{ title?: string; detail?: string }>;
  keyMoments?: Array<{ title?: string; occurredAt?: string; summary?: string; severity?: string }>;
  narrativePhases?: Array<{ title?: string; summary?: string; evidenceItems?: string[] }>;
  riskFlags?: string[];
  nextInterviewFocus?: string[];
};

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'report';
}

function bullet(items: string[] | undefined) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  return safeItems.length ? safeItems.map((item) => `- ${item}`).join('\n') : '- No evidence captured.';
}

function section(title: string, body: string) {
  return [`## ${title}`, '', body.trim() || 'No data captured.'].join('\n');
}

function markdownList<T>(items: T[] | undefined, render: (item: T) => string) {
  if (!Array.isArray(items) || !items.length) return 'No data captured.';
  return items.map(render).join('\n\n');
}

function reportJson(reportJson: string) {
  return parseJson<ReportJsonShape>(reportJson, {});
}

export async function getReportExport(input: ReportExportInput) {
  const session = await db.candidateSession.findFirst({
    where: {
      id: input.sessionId,
      assessment: { workspaceId: input.workspaceId },
    },
    include: {
      candidate: true,
      assessment: { include: { challenge: true } },
      evaluationReport: true,
      aiMessages: { orderBy: { createdAt: 'asc' } },
      commandRuns: { orderBy: { startedAt: 'asc' }, include: { testResults: true } },
      fileSnapshots: { orderBy: [{ path: 'asc' }, { version: 'asc' }] },
    },
  });

  if (!session?.evaluationReport) return null;

  const report = reportJson(session.evaluationReport.reportJson);
  const diffEvidence = await getSessionDiffEvidence(session.id);
  const finalFiles = Array.from(
    session.fileSnapshots.reduce(
      (map, snapshot) => map.set(snapshot.path, snapshot),
      new Map<string, (typeof session.fileSnapshots)[number]>(),
    ),
  )
    .map(([, snapshot]) => snapshot)
    .sort((a, b) => a.path.localeCompare(b.path));
  const baseFileName = `${slug(session.candidate.name)}-${slug(session.assessment.title)}-report`;

  if (input.format === 'json') {
    return {
      fileName: `${baseFileName}.json`,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          candidate: {
            name: session.candidate.name,
            email: session.candidate.email,
          },
          assessment: {
            title: session.assessment.title,
            challenge: session.assessment.challenge.title,
            role: session.assessment.role,
            seniority: session.assessment.seniority,
            durationMinutes: session.assessment.durationMinutes,
          },
          report,
          aiMessages: session.aiMessages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            createdAt: message.createdAt.toISOString(),
            model: message.model,
          })),
          commandRuns: session.commandRuns.map((run) => ({
            id: run.id,
            command: run.command,
            status: run.status,
            exitCode: run.exitCode,
            startedAt: run.startedAt.toISOString(),
            finishedAt: run.finishedAt?.toISOString() || null,
            output: run.output,
            testResults: run.testResults.map((testResult) => ({
              name: testResult.name,
              status: testResult.status,
              message: testResult.message,
            })),
          })),
          diffEvidence,
          finalFiles: finalFiles.map((file) => ({
            path: file.path,
            language: file.language,
            version: file.version,
            source: file.source,
            content: file.content,
          })),
        },
        null,
        2,
      ),
    };
  }

  const markdown = [
    `# ${session.candidate.name} Report`,
    '',
    `- Candidate: ${session.candidate.name} <${session.candidate.email}>`,
    `- Assessment: ${session.assessment.title}`,
    `- Challenge: ${session.assessment.challenge.title}`,
    `- Completed: ${session.submittedAt?.toISOString() || 'not captured'}`,
    `- Recommendation: ${report.overallRecommendation || session.evaluationReport.overallRecommendation}`,
    `- Overall score: ${report.overallScore ?? session.evaluationReport.overallScore}`,
    `- Rubric: ${report.rubricVersion || 'unknown'}`,
    '',
    section('Summary', report.summary || session.evaluationReport.summary),
    section('Risk Flags', bullet(report.riskFlags)),
    section(
      'Areas for Growth',
      markdownList(report.areasForGrowth, (area) => `- ${area.title || 'Growth area'}: ${area.detail || 'No detail captured.'}`),
    ),
    section(
      'Score Breakdown',
      markdownList(report.dimensionScores, (dimension) =>
        [
          `### ${dimension.dimension || 'Dimension'}: ${dimension.score ?? 'n/a'}/5`,
          '',
          '**Evidence**',
          bullet(dimension.evidence),
          '',
          '**Strengths**',
          bullet(dimension.strengths),
          '',
          '**Concerns**',
          bullet(dimension.concerns),
          '',
          '**Follow-up Questions**',
          bullet(dimension.followUpQuestions),
        ].join('\n'),
      ),
    ),
    section(
      'Key Moments',
      markdownList(report.keyMoments, (moment) =>
        `- ${moment.occurredAt || 'unknown time'} - ${moment.title || 'Moment'}${moment.severity ? ` (${moment.severity})` : ''}: ${moment.summary || ''}`,
      ),
    ),
    section(
      'Narrative',
      markdownList(report.narrativePhases, (phase) =>
        [
          `### ${phase.title || 'Phase'}`,
          phase.summary || 'No phase summary captured.',
          '',
          bullet(phase.evidenceItems),
        ].join('\n'),
      ),
    ),
    section(
      'Commands',
      markdownList(session.commandRuns, (run) =>
        [
          `### $ ${run.command}`,
          `- Status: ${run.status}`,
          `- Exit code: ${run.exitCode ?? 'n/a'}`,
          '',
          '```text',
          run.output,
          '```',
        ].join('\n'),
      ),
    ),
    section(
      'AI Transcript',
      markdownList(session.aiMessages, (message) =>
        [`### ${message.role} ${message.createdAt.toISOString()}`, '', message.content].join('\n'),
      ),
    ),
    section(
      'Changed Files',
      diffEvidence.changedFiles.length
        ? diffEvidence.changedFiles
            .map((file) => `- ${file.path}: +${file.additions} / -${file.deletions}`)
            .join('\n')
        : 'No changed files captured.',
    ),
    section(
      'Final Files',
      finalFiles.map((file) => `- ${file.path} (${file.language}, v${file.version}, ${file.source})`).join('\n'),
    ),
  ].join('\n\n');

  return {
    fileName: `${baseFileName}.md`,
    contentType: 'text/markdown; charset=utf-8',
    body: markdown,
  };
}
