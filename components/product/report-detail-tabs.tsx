'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  Download,
  FileCode2,
  FileDiff as FileDiffIcon,
  MessageSquare,
  Radar,
  Terminal,
} from 'lucide-react';
import { StatusPill } from '@/components/product/status-pill';
import type { FileDiff as CodeFileDiff } from '@/lib/diff/text-diff';
import { cn } from '@/lib/utils';

export type ReportDetailTabsData = {
  candidate: {
    name: string;
    email: string;
    assessmentTitle: string;
  };
  report: {
    rubricVersion?: string;
    overallRecommendation: string;
    overallScore: number;
    summary: string;
    timelineSummary: string;
    codeQualitySummary: string;
    aiUsageSummary: string;
    sandboxSummary: string;
    dimensionScores: DimensionScore[];
    scoreBreakdown: ScoreBreakdown[];
    areasForGrowth: GrowthArea[];
    keyMoments: KeyMoment[];
    activityBreakdown: ActivityBreakdown[];
    promptComplexity: PromptComplexity[];
    narrativePhases: NarrativePhase[];
    riskFlags: string[];
    nextInterviewFocus: string[];
    tokenUsageSummary?: TokenUsageSummary;
    aiCaveats: string[];
  };
  auditRows: AuditRowData[];
  aiMessages: AiTranscriptMessage[];
  commandRuns: CommandRunItem[];
  diffEvidence: {
    changedFiles: CodeFileDiff[];
    checkpoints: TimelineCheckpoint[];
    summary: {
      changedFileCount: number;
      totalAdditions: number;
      totalDeletions: number;
      checkpointCount: number;
    };
  };
  finalFiles: FinalFile[];
  exportUrls?: {
    markdown: string;
    json: string;
  };
};

type DimensionScore = {
  dimension: string;
  score: number;
  evidence: string[];
  strengths: string[];
  concerns: string[];
  followUpQuestions: string[];
};

type ScoreBreakdown = {
  dimension: string;
  score: number;
  evidenceSummary?: string;
  concernSummary?: string;
  rationale?: string;
};

type GrowthArea = {
  title: string;
  detail: string;
};

type KeyMoment = {
  type: string;
  title: string;
  occurredAt: string;
  summary: string;
  severity?: string;
};

type ActivityBreakdown = {
  category: string;
  count: number;
  seconds: number;
  minutes: number;
};

type PromptComplexity = {
  occurredAt: string;
  score: number;
  excerpt: string;
};

type NarrativePhase = {
  title: string;
  timeRange?: string | null;
  timestamp?: string | null;
  summary: string;
  evidenceItems: string[];
};

type TokenUsageSummary = {
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

type AuditRowData = {
  label: string;
  value: string;
};

type AiTranscriptMessage = {
  id: string;
  role: string;
  content: string;
  tokenUsageLabel?: string | null;
};

type CommandRunItem = {
  id: string;
  command: string;
  output: string;
  exitCode: number | null;
  sandbox?: {
    providerId?: string;
    readiness?: string;
    executionMode?: string;
    isolationLevel?: string;
    sandboxRunId?: string;
    cleanupStatus?: string;
    skippedReason?: string;
    outputTruncated?: boolean;
  };
};

type TimelineCheckpoint = {
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

type FinalFile = {
  id: string;
  path: string;
  content: string;
};

const tabs = [
  { id: 'overview', label: 'Overview', icon: Radar },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'analysis', label: 'Analysis', icon: BarChart3 },
  { id: 'narrative', label: 'Narrative', icon: MessageSquare },
  { id: 'files', label: 'Files', icon: FileDiffIcon },
] as const;

type TabId = (typeof tabs)[number]['id'];

export function ReportDetailTabs({ data }: { data: ReportDetailTabsData }) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const active = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  return (
    <div className="grid gap-6">
      {data.exportUrls && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white/60 p-4">
          <div>
            <p className="text-sm font-black">Reviewer export</p>
            <p className="mt-1 text-xs text-black/55">Export uses the same persisted report, transcript, commands, diffs, and final files shown here.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={data.exportUrls.markdown}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[#111] px-3 text-xs font-black text-paper"
            >
              <Download className="h-3.5 w-3.5" />
              Markdown
            </a>
            <a
              href={data.exportUrls.json}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-black text-black/70"
            >
              <Download className="h-3.5 w-3.5" />
              JSON evidence
            </a>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-black/10 bg-white/60 p-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = tab.id === active.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black text-black/60 transition',
                  selected ? 'bg-[#111] text-paper shadow-sm' : 'hover:bg-black/5 hover:text-black',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'overview' && <OverviewTab data={data} />}
      {activeTab === 'timeline' && <TimelineTab data={data} />}
      {activeTab === 'analysis' && <AnalysisTab data={data} />}
      {activeTab === 'narrative' && <NarrativeTab data={data} />}
      {activeTab === 'files' && <FilesTab data={data} />}
    </div>
  );
}

function OverviewTab({ data }: { data: ReportDetailTabsData }) {
  const { report } = data;
  const strongest = [...report.dimensionScores].sort((a, b) => b.score - a.score).slice(0, 3);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="grid gap-4">
        <div className="rounded-xl border border-black/10 bg-[#111] p-6 text-paper">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-paper/45">Candidate summary</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-3xl font-black md:text-4xl">{data.candidate.name}</p>
              <p className="mt-1 text-sm text-paper/55">{data.candidate.email}</p>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-paper/70">{report.summary}</p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-5xl font-black">{report.overallScore}</p>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-paper/45">avg score</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-sm font-black capitalize text-black">
              {report.overallRecommendation.replaceAll('_', ' ')}
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold text-paper/55">
              {report.rubricVersion || 'unknown rubric'}
            </span>
          </div>
        </div>

        <Panel title="Areas for growth" icon={Activity}>
          <div className="grid gap-3">
            {report.areasForGrowth.length ? (
              report.areasForGrowth.map((area) => (
                <div key={`${area.title}-${area.detail}`} className="border-l-2 border-[#d12864] pl-3">
                  <p className="font-bold">{area.title}</p>
                  <p className="mt-1 text-sm leading-6 text-black/65">{area.detail}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-black/55">No focused growth areas were captured.</p>
            )}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4">
        <Panel title="Rubric visual" icon={Radar}>
          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <RadarChart dimensions={report.dimensionScores} />
            <div className="grid content-start gap-3">
              {report.dimensionScores.map((dimension) => (
                <ScoreBar key={dimension.dimension} label={dimension.dimension} value={dimension.score} />
              ))}
            </div>
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Risk flags" icon={CheckCircle2}>
            <div className="flex flex-wrap gap-2">
              {report.riskFlags.length ? (
                report.riskFlags.map((flag) => <StatusPill key={flag} status={flag} />)
              ) : (
                <span className="text-sm text-black/55">No automatic risk flags.</span>
              )}
            </div>
          </Panel>

          <Panel title="Strongest signals" icon={BarChart3}>
            <div className="grid gap-2">
              {strongest.length ? (
                strongest.map((dimension) => (
                  <div key={dimension.dimension} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-black/70">{dimension.dimension}</span>
                    <span className="rounded-full bg-[#111] px-2.5 py-1 font-black text-paper">{dimension.score}/5</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-black/55">No dimension scores were captured.</p>
              )}
            </div>
          </Panel>
        </div>

        <Panel title="Next interview focus" icon={CheckCircle2}>
          <ul className="grid gap-2">
            {report.nextInterviewFocus.length ? (
              report.nextInterviewFocus.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-black/70">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#d12864]" />
                  {item}
                </li>
              ))
            ) : (
              <li className="text-sm text-black/55">No follow-up focus was captured.</li>
            )}
          </ul>
        </Panel>
      </section>
    </div>
  );
}

function TimelineTab({ data }: { data: ReportDetailTabsData }) {
  const maxActivity = Math.max(1, ...data.report.activityBreakdown.map((item) => Math.max(item.count, item.minutes)));
  const complexityPoints = data.report.promptComplexity.map((item, index, list) => {
    const x = list.length <= 1 ? 8 : 8 + (index / (list.length - 1)) * 84;
    const y = 44 - (Math.min(5, Math.max(0, item.score)) / 5) * 32;
    return `${x},${y}`;
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <Panel title="Key moments" icon={Clock}>
        <ol className="grid gap-3">
          {data.report.keyMoments.length ? (
            data.report.keyMoments.map((moment) => (
              <li key={`${moment.type}-${moment.occurredAt}`} className="grid grid-cols-[14px_1fr] gap-3">
                <span className={cn('mt-1 h-3 w-3 rounded-full bg-black', moment.severity === 'warning' && 'bg-amber-500', moment.severity === 'info' && 'bg-blue-500')} />
                <div className="rounded-lg border border-black/10 bg-[#f7f0e7] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">{moment.title}</p>
                    <time className="font-mono text-[10px] text-black/45">{formatDateTime(moment.occurredAt)}</time>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-black/65">{moment.summary}</p>
                </div>
              </li>
            ))
          ) : (
            <li className="text-sm text-black/55">No key moments were captured.</li>
          )}
        </ol>
      </Panel>

      <section className="grid gap-4">
        <Panel title="Activity breakdown" icon={Activity}>
          <div className="grid gap-3">
            {data.report.activityBreakdown.length ? (
              data.report.activityBreakdown.map((item) => {
                const width = `${(Math.max(item.count, item.minutes) / maxActivity) * 100}%`;
                return (
                  <div key={item.category}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="font-bold">{item.category}</span>
                      <span className="font-mono text-xs text-black/45">
                        {item.count} events{item.minutes ? ` · ${item.minutes}m` : ''}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-black/10">
                      <div className="h-full rounded-full bg-[#111]" style={{ width }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-black/55">No activity breakdown was captured.</p>
            )}
          </div>
        </Panel>

        <Panel title="Prompt complexity" icon={Bot}>
          {data.report.promptComplexity.length ? (
            <div className="grid gap-4">
              <svg viewBox="0 0 100 48" role="img" aria-label="Prompt complexity over time" className="h-32 w-full overflow-visible">
                <path d="M8 44H96" stroke="rgba(0,0,0,.16)" strokeWidth="1" />
                <path d="M8 12H96" stroke="rgba(0,0,0,.08)" strokeWidth="1" />
                <polyline points={complexityPoints.join(' ')} fill="none" stroke="#d12864" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {complexityPoints.map((point) => {
                  const [cx, cy] = point.split(',').map(Number);
                  return <circle key={point} cx={cx} cy={cy} r="2.5" fill="#111" />;
                })}
              </svg>
              <div className="grid gap-2">
                {data.report.promptComplexity.map((item) => (
                  <div key={`${item.occurredAt}-${item.excerpt}`} className="rounded-lg bg-[#f7f0e7] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <time className="font-mono text-[10px] text-black/45">{formatDateTime(item.occurredAt)}</time>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-black">{item.score}/5</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-black/65">{item.excerpt}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-black/55">No user prompts were captured.</p>
          )}
        </Panel>

        <Panel title="Diff checkpoints" icon={FileDiffIcon}>
          <CheckpointTimeline checkpoints={data.diffEvidence.checkpoints} />
        </Panel>
      </section>
    </div>
  );
}

function AnalysisTab({ data }: { data: ReportDetailTabsData }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Panel title="Score breakdown" icon={BarChart3}>
        <div className="grid gap-3">
          {(data.report.scoreBreakdown.length ? data.report.scoreBreakdown : data.report.dimensionScores).map((dimension) => (
            <details key={dimension.dimension} className="rounded-lg border border-black/10 bg-[#f7f0e7] p-4" open={dimension.score <= 3}>
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">{dimension.dimension}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-black">{dimension.score}/5</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10">
                  <div className="h-full rounded-full bg-[#111]" style={{ width: `${Math.min(100, Math.max(0, dimension.score * 20))}%` }} />
                </div>
              </summary>
              <div className="mt-4 grid gap-2 text-sm leading-6 text-black/70">
                {'evidenceSummary' in dimension && dimension.evidenceSummary && <p><strong>Evidence:</strong> {dimension.evidenceSummary}</p>}
                {'concernSummary' in dimension && dimension.concernSummary && <p><strong>Concern:</strong> {dimension.concernSummary}</p>}
                {'rationale' in dimension && dimension.rationale && <p><strong>Rationale:</strong> {dimension.rationale}</p>}
              </div>
            </details>
          ))}
        </div>
      </Panel>

      <section className="grid gap-4">
        <Panel title="Dimension evidence" icon={CheckCircle2}>
          <div className="grid gap-3">
            {data.report.dimensionScores.map((dimension) => (
              <details key={dimension.dimension} className="rounded-lg border border-black/10 bg-[#f7f0e7] p-3">
                <summary className="cursor-pointer text-sm font-black">{dimension.dimension}</summary>
                <div className="mt-3 grid gap-3 text-sm text-black/70">
                  <EvidenceList title="Evidence" items={dimension.evidence} />
                  <EvidenceList title="Strengths" items={dimension.strengths} />
                  <EvidenceList title="Concerns" items={dimension.concerns} />
                  <EvidenceList title="Follow-ups" items={dimension.followUpQuestions} />
                </div>
              </details>
            ))}
          </div>
        </Panel>

        <SummaryPanel title="AI usage" body={data.report.aiUsageSummary} icon={Bot} />
        <TokenUsageCard summary={data.report.tokenUsageSummary} caveats={data.report.aiCaveats} />
        <SummaryPanel title="Sandbox summary" body={data.report.sandboxSummary} icon={Terminal} />
        <AuditPanel rows={data.auditRows} />
      </section>
    </div>
  );
}

function NarrativeTab({ data }: { data: ReportDetailTabsData }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel title="Narrative phases" icon={MessageSquare}>
        <div className="grid gap-4">
          {data.report.narrativePhases.length ? (
            data.report.narrativePhases.map((phase, index) => (
              <div key={`${phase.title}-${index}`} className="rounded-lg border border-black/10 bg-[#f7f0e7] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-black">{phase.title}</p>
                  {(phase.timeRange || phase.timestamp) && (
                    <span className="font-mono text-[10px] text-black/45">{phase.timeRange || formatDateTime(phase.timestamp || '')}</span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-black/70">{phase.summary}</p>
                <EvidenceList title="Evidence" items={phase.evidenceItems} />
              </div>
            ))
          ) : (
            <p className="text-sm text-black/55">No narrative phases were captured.</p>
          )}
        </div>
      </Panel>

      <section className="grid gap-4">
        <Panel title="AI transcript" icon={Bot}>
          <TranscriptList messages={data.aiMessages} />
        </Panel>

        <Panel title="Commands and tests" icon={Terminal}>
          <CommandList commandRuns={data.commandRuns} />
        </Panel>
      </section>
    </div>
  );
}

function FilesTab({ data }: { data: ReportDetailTabsData }) {
  return (
    <div className="grid gap-6">
      <Panel title="Final diff" icon={FileDiffIcon}>
        {data.diffEvidence.changedFiles.length ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-black px-3 py-1 font-bold text-white">
                {data.diffEvidence.summary.changedFileCount} files changed
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700">
                +{data.diffEvidence.summary.totalAdditions}
              </span>
              <span className="rounded-full bg-red-100 px-3 py-1 font-bold text-red-700">
                -{data.diffEvidence.summary.totalDeletions}
              </span>
            </div>
            {data.diffEvidence.changedFiles.map((file, index) => (
              <details key={file.path} className="rounded-lg border border-black/10 bg-[#111] text-paper" open={index === 0}>
                <summary className="cursor-pointer px-4 py-3 font-mono text-sm">
                  {file.path}
                  <span className="ml-3 text-xs text-paper/45">+{file.additions} / -{file.deletions}</span>
                </summary>
                <ReportSplitDiffViewer diff={file} />
              </details>
            ))}
          </div>
        ) : (
          <p className="text-sm text-black/55">No changed files were captured.</p>
        )}
      </Panel>

      <Panel title="Final files" icon={FileCode2}>
        <div className="grid gap-4">
          {data.finalFiles.length ? (
            data.finalFiles.map((file) => (
              <details key={file.id} className="rounded-lg border border-black/10 bg-[#111] text-paper">
                <summary className="cursor-pointer px-4 py-3 font-mono text-sm">{file.path}</summary>
                <pre className="max-h-[420px] overflow-auto border-t border-white/10 p-4 text-xs leading-5 text-paper/75">
                  {file.content}
                </pre>
              </details>
            ))
          ) : (
            <p className="text-sm text-black/55">No final files were captured.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

function RadarChart({ dimensions }: { dimensions: DimensionScore[] }) {
  const points = useMemo(() => {
    const safeDimensions = dimensions.length ? dimensions : [{ dimension: 'No scores', score: 0, evidence: [], strengths: [], concerns: [], followUpQuestions: [] }];
    return safeDimensions.map((dimension, index) => {
      const angle = (Math.PI * 2 * index) / safeDimensions.length - Math.PI / 2;
      const radius = (Math.min(5, Math.max(0, dimension.score)) / 5) * 78;
      return {
        label: dimension.dimension,
        x: 100 + Math.cos(angle) * radius,
        y: 100 + Math.sin(angle) * radius,
        axisX: 100 + Math.cos(angle) * 86,
        axisY: 100 + Math.sin(angle) * 86,
      };
    });
  }, [dimensions]);

  return (
    <div className="grid place-items-center">
      <svg viewBox="0 0 200 200" className="h-56 w-56" role="img" aria-label="Rubric score radar">
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <circle key={level} cx="100" cy="100" r={86 * level} fill="none" stroke="rgba(0,0,0,.1)" />
        ))}
        {points.map((point) => (
          <line key={point.label} x1="100" y1="100" x2={point.axisX} y2={point.axisY} stroke="rgba(0,0,0,.1)" />
        ))}
        <polygon points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="rgba(209,40,100,.18)" stroke="#d12864" strokeWidth="2" />
        {points.map((point) => (
          <circle key={`${point.label}-dot`} cx={point.x} cy={point.y} r="3.5" fill="#111" />
        ))}
      </svg>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="font-bold text-black/75">{label}</span>
        <span className="font-mono text-xs text-black/45">{value}/5</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/10">
        <div className="h-full rounded-full bg-[#111]" style={{ width: `${Math.min(100, Math.max(0, value * 20))}%` }} />
      </div>
    </div>
  );
}

function SummaryPanel({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Panel title={title} icon={icon}>
      <p className="text-sm leading-6 text-black/65">{body}</p>
    </Panel>
  );
}

function TokenUsageCard({
  summary,
  caveats,
}: {
  summary: TokenUsageSummary | undefined;
  caveats: string[];
}) {
  return (
    <Panel title="Token usage" icon={Bot}>
      {summary ? (
        <>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="Total tokens" value={summary.totalTokens.toLocaleString()} />
            <Metric label="Prompts" value={summary.promptCount.toLocaleString()} />
            <Metric label="Useful responses" value={summary.usefulResponses.toLocaleString()} />
            <Metric label="Guardrails" value={summary.guardrailResponses.toLocaleString()} />
            <Metric label="Fallbacks" value={summary.fallbackResponses.toLocaleString()} />
            <Metric label="Provider measured" value={summary.providerTokenResponses.toLocaleString()} />
          </dl>
          <p className="mt-3 font-mono text-xs text-black/45">
            input {summary.promptTokens.toLocaleString()} · output {summary.completionTokens.toLocaleString()} · estimated responses{' '}
            {summary.estimatedTokenResponses.toLocaleString()}
          </p>
          {caveats.length > 0 && (
            <ul className="mt-3 grid gap-1 text-xs leading-5 text-black/55">
              {caveats.map((caveat) => (
                <li key={caveat}>- {caveat}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-sm text-black/55">No AI token usage was captured for this report.</p>
      )}
    </Panel>
  );
}

function AuditPanel({ rows }: { rows: AuditRowData[] }) {
  return (
    <details className="rounded-xl border border-black/10 bg-white/60 p-5">
      <summary className="cursor-pointer list-none font-black">Audit metadata</summary>
      <dl className="mt-4 grid gap-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1">
            <dt className="text-[10px] font-black uppercase tracking-[0.16em] text-black/45">{row.label}</dt>
            <dd className="break-words font-mono text-xs text-black/70">{row.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-[#f7f0e7] p-3">
      <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-black/45">{label}</dt>
      <dd className="mt-1 text-xl font-black text-black">{value}</dd>
    </div>
  );
}

function EvidenceList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mt-3 font-bold text-black">{title}</p>
      <ul className="mt-1 grid gap-1">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}

function TranscriptList({ messages }: { messages: AiTranscriptMessage[] }) {
  if (!messages.length) {
    return <p className="text-sm text-black/55">No AI messages captured.</p>;
  }

  return (
    <div className="grid max-h-[520px] gap-3 overflow-auto">
      {messages.map((message) => (
        <div key={message.id} className="rounded-lg bg-[#f7f0e7] p-3 text-sm">
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-black/45">{message.role}</p>
          <p className="whitespace-pre-wrap text-black/70">{message.content}</p>
          {message.tokenUsageLabel && (
            <p className="mt-3 rounded-md bg-white px-3 py-2 font-mono text-[11px] text-black/50">{message.tokenUsageLabel}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function CommandList({ commandRuns }: { commandRuns: CommandRunItem[] }) {
  if (!commandRuns.length) {
    return <p className="text-sm text-black/55">No command runs captured.</p>;
  }

  return (
    <div className="grid max-h-[520px] gap-3 overflow-auto">
      {commandRuns.map((run) => (
        <div key={run.id} id={`command-${run.id}`} className="rounded-lg bg-[#111] p-3 font-mono text-xs text-paper">
          <div className="flex items-center justify-between gap-3">
            <span>$ {run.command}</span>
            <span>{run.exitCode === 0 ? 'exit 0' : `exit ${run.exitCode ?? 'n/a'}`}</span>
          </div>
          {run.sandbox && (
            <dl className="mt-3 grid gap-1 rounded-md border border-white/10 bg-white/[0.04] p-3 text-[11px] text-paper/55 sm:grid-cols-2">
              <div>provider: {run.sandbox.providerId || 'unknown'}</div>
              <div>readiness: {run.sandbox.readiness || 'unknown'}</div>
              <div>execution: {run.sandbox.executionMode || 'unknown'}</div>
              <div>isolation: {run.sandbox.isolationLevel || 'unknown'}</div>
              <div>run: {run.sandbox.sandboxRunId || 'not captured'}</div>
              <div>cleanup: {run.sandbox.cleanupStatus || 'unknown'}</div>
              {run.sandbox.skippedReason && <div className="text-amber-200 sm:col-span-2">skipped: {run.sandbox.skippedReason}</div>}
              {run.sandbox.outputTruncated && <div className="text-amber-200 sm:col-span-2">output truncated</div>}
            </dl>
          )}
          <pre className="mt-3 whitespace-pre-wrap text-paper/70">{run.output}</pre>
        </div>
      ))}
    </div>
  );
}

function CheckpointTimeline({ checkpoints }: { checkpoints: TimelineCheckpoint[] }) {
  if (!checkpoints.length) {
    return <p className="text-sm text-black/55">No checkpoint evidence was captured.</p>;
  }

  return (
    <ol className="grid gap-3">
      {checkpoints.map((checkpoint) => (
        <li key={checkpoint.id} className="rounded-lg border border-black/10 bg-[#f7f0e7] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">{checkpoint.label}</p>
            <time className="font-mono text-[10px] text-black/45">{formatDateTime(checkpoint.occurredAt)}</time>
          </div>
          <p className="mt-1 text-sm text-black/65">{checkpoint.summary}</p>
          {checkpoint.filePath && (
            <p className="mt-2 font-mono text-[11px] text-black/45">
              {checkpoint.filePath}
              {checkpoint.version ? ` v${checkpoint.version}` : ''}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function ReportSplitDiffViewer({ diff }: { diff: CodeFileDiff }) {
  return (
    <div className="max-h-[480px] overflow-auto border-t border-white/10">
      <div className="sticky top-0 z-10 grid min-w-[900px] grid-cols-2 border-b border-white/10 bg-[#181818] text-xs font-black uppercase tracking-[0.16em] text-paper/40">
        <div className="border-r border-white/10 px-4 py-3">Original</div>
        <div className="px-4 py-3">Current</div>
      </div>
      <div className="min-w-[900px] font-mono text-xs leading-5">
        {diff.rows.map((row) => (
          <div
            key={row.id}
            className={cn(
              'grid grid-cols-2 border-b border-white/[0.04]',
              row.kind === 'added' && 'bg-emerald-500/[0.06]',
              row.kind === 'removed' && 'bg-red-500/[0.06]',
            )}
          >
            <div
              className={cn(
                'grid min-w-0 grid-cols-[48px_minmax(0,1fr)] border-r border-white/10',
                row.kind === 'removed' && 'bg-red-500/[0.08] text-red-100',
              )}
            >
              <span className="select-none px-3 py-1 text-right text-paper/25">{row.oldLineNumber ?? ''}</span>
              <code data-testid="split-diff-code-cell" className="min-w-0 whitespace-pre-wrap break-words px-3 py-1 text-paper/70 [overflow-wrap:anywhere]">
                {row.oldContent}
              </code>
            </div>
            <div
              className={cn(
                'grid min-w-0 grid-cols-[48px_minmax(0,1fr)]',
                row.kind === 'added' && 'bg-emerald-500/[0.08] text-emerald-100',
              )}
            >
              <span className="select-none px-3 py-1 text-right text-paper/25">{row.newLineNumber ?? ''}</span>
              <code data-testid="split-diff-code-cell" className="min-w-0 whitespace-pre-wrap break-words px-3 py-1 text-paper/70 [overflow-wrap:anywhere]">
                {row.newContent}
              </code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white/60 p-5">
      <h2 className="flex items-center gap-2 font-black">
        <Icon className="h-4 w-4 text-[#d12864]" />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
