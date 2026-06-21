'use client';

import { Fragment, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Building2, Clock, Cpu, Lightbulb, Play, RotateCcw, Send, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDraftAutosave } from './use-draft-autosave';
import { Language, Verdict } from '@/lib/constants';
import { LANGUAGE_LIST } from '@/lib/languages';

// Monaco is browser-only — load it client-side without SSR.
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then((m) => m.default), {
  ssr: false,
  loading: () => <div className="flex-1 bg-[#1e1e1e] p-5 font-mono text-sm text-white/30">Loading editor…</div>,
});

export type ProblemSample = { input: string; expected: string };

export type ProblemPayload = {
  title: string;
  difficulty: string;
  statementMd: string;
  constraintsMd: string | null;
  inputFormat: string | null;
  outputFormat: string | null;
  timeLimitMs: number;
  memoryLimitMb: number;
  kind: string;
  functionMode: boolean;
  functionName: string | null;
  boilerplates: Record<Language, string>;
  categoryTags: string[];
  companyTags: string[];
  hints: string[];
  samples: ProblemSample[];
};

// Derived from the language registry — a new first-class language appears in the
// picker and editor automatically, no edits here.
const LANGUAGES: { value: Language; label: string }[] = LANGUAGE_LIST.map((def) => ({
  value: def.id,
  label: def.label,
}));

const MONACO_LANGUAGE = Object.fromEntries(
  LANGUAGE_LIST.map((def) => [def.id, def.monacoId]),
) as Record<Language, string>;

// Shape returned by runSamples (samples are public, so input/expected/stdout are present).
type RunResult = {
  index: number;
  status: Verdict;
  input: string;
  expected: string;
  stdout: string;
  stderr: string;
  runtimeMs: number;
};
type RunResponse = { sampleCount: number; results: RunResult[]; compileError?: string | null };

// Shape returned by submitSolution. NOTE: per-test results contain ONLY index +
// status + timing — no hidden inputs/outputs.
type SubmitTestResult = {
  index: number;
  status: Verdict;
  runtimeMs: number;
  memoryKb: number | null;
};
type SubmitResponse = {
  submissionId: string;
  verdict: Verdict;
  passedCount: number;
  totalCount: number;
  runtimeMs: number;
  memoryKb: number | null;
  failingCase: number | null;
  message: string | null;
  results: SubmitTestResult[];
};

const VERDICT_LABEL: Record<Verdict, string> = {
  accepted: 'Accepted',
  wrong_answer: 'Wrong answer',
  tle: 'Time limit exceeded',
  mle: 'Memory limit exceeded',
  runtime_error: 'Runtime error',
  compile_error: 'Compile error',
  error: 'Error',
  judging: 'Judging',
};

function verdictChipClass(verdict: Verdict) {
  if (verdict === Verdict.ACCEPTED) return 'bg-emerald-500/15 text-emerald-200';
  if (verdict === Verdict.TLE || verdict === Verdict.MLE) return 'bg-amber-500/15 text-amber-200';
  if (verdict === Verdict.JUDGING) return 'bg-white/10 text-white/60';
  return 'bg-red-500/15 text-red-200';
}

function difficultyChipClass(difficulty: string) {
  const key = difficulty.toLowerCase();
  if (key === 'easy') return 'bg-emerald-500/15 text-emerald-200';
  if (key === 'hard') return 'bg-red-500/15 text-red-200';
  if (key === 'medium') return 'bg-amber-500/15 text-amber-200';
  return 'bg-white/10 text-white/60';
}

export function ProblemWorkspace({ slug, problem, authed }: { slug: string; problem: ProblemPayload; authed: boolean }) {
  const [language, setLanguage] = useState<Language>(Language.CPP);
  // One source buffer per language, each seeded from its boilerplate. Switching
  // languages preserves whatever the candidate has typed in the other buffers.
  const [sources, setSources] = useState<Record<Language, string>>(() => ({ ...problem.boilerplates }));
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResults, setRunResults] = useState<RunResponse | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hintsShown, setHintsShown] = useState(0);

  const source = sources[language];
  const setSource = (value: string) => setSources((prev) => ({ ...prev, [language]: value }));
  const resetBoilerplate = () => setSources((prev) => ({ ...prev, [language]: problem.boilerplates[language] }));
  const pending = running || submitting;

  // Autosave the editor so a reload never loses work. Recovery only overwrites a
  // buffer that's still pristine boilerplate, so it can't clobber live typing.
  const applyRecoveredDraft = (lang: Language, recovered: string) => {
    setSources((prev) => (prev[lang] === problem.boilerplates[lang] ? { ...prev, [lang]: recovered } : prev));
  };
  const { status: saveStatus } = useDraftAutosave({ slug, language, source, authed, onRecover: applyRecoveredDraft });

  async function runSamples() {
    if (!source.trim() || pending) return;
    setRunning(true);
    setError(null);
    setSubmitResult(null);
    try {
      const response = await fetch(`/api/dsa/problems/${slug}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, source }),
      });
      if (!response.ok) throw new Error('Run failed');
      const body = (await response.json()) as RunResponse;
      setRunResults(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }

  async function submit() {
    if (!source.trim() || pending) return;
    setSubmitting(true);
    setError(null);
    setRunResults(null);
    // One key per Submit click. A network retry of this same click reuses it,
    // so the server judges the attempt exactly once (idempotent submit).
    const idempotencyKey = crypto.randomUUID();
    try {
      const response = await fetch(`/api/dsa/problems/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, source, idempotencyKey }),
      });
      if (!response.ok) throw new Error('Submit failed');
      const body = (await response.json()) as SubmitResponse;
      setSubmitResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#111] text-paper lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <header className="flex h-16 items-center justify-between border-b border-white/10 bg-[#171717] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dsa"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Back to problems"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{problem.title}</p>
            <p className="flex items-center gap-2 text-xs text-white/45">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]',
                  difficultyChipClass(problem.difficulty),
                )}
              >
                {problem.difficulty}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {problem.timeLimitMs} ms
              </span>
              <span className="inline-flex items-center gap-1">
                <Cpu className="h-3 w-3" />
                {problem.memoryLimitMb} MB
              </span>
              {problem.companyTags.map((company) => (
                <span key={company} className="inline-flex items-center gap-1 rounded-full bg-[#f15a29]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#f7a07f]">
                  <Building2 className="h-3 w-3" />
                  {company}
                </span>
              ))}
            </p>
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:min-h-0 lg:grid-cols-2">
        {/* Left: statement */}
        <section className="min-h-0 overflow-auto border-b border-white/10 bg-[#141414] p-6 lg:border-b-0 lg:border-r">
          <Markdown content={problem.statementMd} />

          {(problem.inputFormat || problem.outputFormat) && (
            <div className="mt-6 grid gap-4">
              {problem.inputFormat && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">Input format</h3>
                  <Markdown content={problem.inputFormat} className="mt-2" />
                </div>
              )}
              {problem.outputFormat && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">Output format</h3>
                  <Markdown content={problem.outputFormat} className="mt-2" />
                </div>
              )}
            </div>
          )}

          {problem.constraintsMd && (
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">Constraints</h3>
              <Markdown content={problem.constraintsMd} className="mt-2" />
            </div>
          )}

          {problem.hints.length > 0 && (
            <div className="mt-6">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-white/40">
                <Lightbulb className="h-3.5 w-3.5" />
                Hints
              </h3>
              <div className="mt-2 grid gap-2">
                {problem.hints.slice(0, hintsShown).map((hint, index) => (
                  <div key={index} className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 text-sm text-amber-100/90">
                    <span className="font-black text-amber-200/70">Hint {index + 1}.</span> {hint}
                  </div>
                ))}
                {hintsShown < problem.hints.length && (
                  <button
                    type="button"
                    onClick={() => setHintsShown((n) => n + 1)}
                    className="w-fit rounded-md border border-white/10 px-3 py-1.5 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    Reveal hint {hintsShown + 1} of {problem.hints.length}
                  </button>
                )}
              </div>
            </div>
          )}

          {problem.categoryTags.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-white/35" />
              {problem.categoryTags.map((tagName) => (
                <span key={tagName} className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white/55">
                  {tagName}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
              Sample cases ({problem.samples.length})
            </h3>
            {problem.samples.length === 0 ? (
              <p className="mt-2 text-sm text-white/45">No sample cases for this problem.</p>
            ) : (
              <div className="mt-3 grid gap-3">
                {problem.samples.map((sample, index) => (
                  <div key={index} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
                      Sample {index + 1}
                    </p>
                    <div className="mt-2 grid gap-2">
                      <IoBlock label="Input" value={sample.input} />
                      <IoBlock label="Expected" value={sample.expected} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right: editor + actions + results */}
        <section className="flex min-h-0 flex-col bg-[#0c0c0c]">
          <div className="flex h-12 items-center justify-between gap-3 border-b border-white/10 px-4">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
              Language
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                disabled={pending}
                className="rounded-md border border-white/10 bg-[#181818] px-2 py-1.5 text-xs font-bold text-white outline-none disabled:opacity-50"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <span
                className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40"
                title="Your code autosaves to this browser; signed-in users also sync across devices."
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    saveStatus === 'saving' ? 'animate-pulse bg-amber-400' : 'bg-emerald-400',
                  )}
                />
                {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={resetBoilerplate}
                title="Reset to starter code"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={!source.trim() || pending}
                onClick={runSamples}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-white/10 px-3 text-xs font-black text-white/75 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5" />
                {running ? 'Running' : 'Run samples'}
              </button>
              <button
                type="button"
                disabled={!source.trim() || pending}
                onClick={submit}
                className="inline-flex h-8 items-center gap-2 rounded-md bg-[#f15a29] px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Send className="h-3.5 w-3.5" />
                {submitting ? 'Submitting' : 'Submit'}
              </button>
            </div>
          </div>

          {problem.functionMode && (
            <p className="border-b border-white/10 bg-white/[0.02] px-4 py-1.5 text-[11px] text-white/45">
              {problem.kind === 'design' ? (
                <>Implement the class methods. The driver runs the operation sequence for you.</>
              ) : (
                <>
                  Implement <code className="rounded bg-black/40 px-1 font-mono text-white/75">{problem.functionName}</code>. Input
                  parsing and output printing are handled for you.
                </>
              )}
            </p>
          )}

          <div className="min-h-[280px] flex-1">
            <MonacoEditor
              language={MONACO_LANGUAGE[language]}
              theme="vs-dark"
              value={source}
              onChange={(value) => setSource(value ?? '')}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                tabSize: 4,
                automaticLayout: true,
                readOnly: pending,
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                fixedOverflowWidgets: true,
              }}
            />
          </div>

          <div className="max-h-[45%] min-h-0 overflow-auto border-t border-white/10 p-4">
            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            {!error && !runResults && !submitResult && (
              <p className="text-sm text-white/40">
                Run against the samples or submit against the full test suite. Hidden test inputs are never shown.
              </p>
            )}

            {runResults?.compileError ? (
              <CompileErrorBanner stderr={runResults.compileError} />
            ) : (
              runResults && <RunResultsView data={runResults} />
            )}
            {submitResult && <SubmitResultView data={submitResult} />}
            {submitResult && submitResult.verdict === Verdict.ACCEPTED && problem.functionMode && (
              <ComplexitySection slug={slug} submissionId={submitResult.submissionId} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function CompileErrorBanner({ stderr }: { stderr: string }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-red-500/15 px-3 py-1 text-sm font-black uppercase tracking-[0.08em] text-red-200">
          Compile error
        </span>
        <span className="text-xs text-white/45">Your code didn&apos;t compile — fix the errors below and run again.</span>
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-red-500/30 bg-black/40 p-3 font-mono text-xs leading-5 text-red-200">
        {stderr.trim() || 'Compilation failed.'}
      </pre>
    </div>
  );
}

function RunResultsView({ data }: { data: RunResponse }) {
  if (data.results.length === 0) {
    return <p className="text-sm text-white/45">No sample cases to run.</p>;
  }
  return (
    <div className="grid gap-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Sample results</p>
      {data.results.map((result) => (
        <div key={result.index} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-white/70">Sample {result.index + 1}</span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-white/40">{result.runtimeMs} ms</span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]',
                  verdictChipClass(result.status),
                )}
              >
                {VERDICT_LABEL[result.status]}
              </span>
            </span>
          </div>
          <div className="mt-2 grid gap-2">
            <IoBlock label="Input" value={result.input} />
            <IoBlock label="Expected" value={result.expected} />
            <IoBlock label="Your output" value={result.stdout} tone={result.status === Verdict.ACCEPTED ? 'ok' : 'bad'} />
            {result.stderr.trim() && <IoBlock label="Stderr" value={result.stderr} tone="bad" />}
          </div>
        </div>
      ))}
    </div>
  );
}

type ComplexityResponse =
  | { supported: false; reason: string }
  | { supported: true; time: string; space: string; timeConfidence: number; spaceConfidence: number; samples: { n: number }[] };

function confidenceLabel(c: number): { text: string; cls: string } {
  if (c >= 0.9) return { text: 'high confidence', cls: 'text-emerald-300' };
  if (c >= 0.6) return { text: 'medium confidence', cls: 'text-amber-300' };
  return { text: 'low confidence', cls: 'text-red-300' };
}

function ComplexitySection({ slug, submissionId }: { slug: string; submissionId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error' | 'unsupported'>('idle');
  const [data, setData] = useState<Extract<ComplexityResponse, { supported: true }> | null>(null);
  const [reason, setReason] = useState('');

  async function analyze() {
    setState('loading');
    try {
      const res = await fetch(`/api/dsa/problems/${slug}/complexity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId }),
      });
      const body = (await res.json()) as ComplexityResponse;
      if (!res.ok) return setState('error');
      if (!body.supported) {
        setReason(body.reason);
        return setState('unsupported');
      }
      setData(body);
      setState('done');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="mt-3 rounded-md border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-white/55">
          <Cpu className="h-3.5 w-3.5" /> Complexity
        </p>
        {state === 'idle' && (
          <button
            type="button"
            onClick={analyze}
            className="rounded-md border border-white/10 px-3 py-1 text-xs font-bold text-white/75 hover:bg-white/10"
          >
            Analyze
          </button>
        )}
        {state === 'loading' && <span className="text-xs text-white/45">Measuring on growing inputs…</span>}
      </div>

      {state === 'done' && data && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {([
            ['Time', data.time, data.timeConfidence],
            ['Space', data.space, data.spaceConfidence],
          ] as const).map(([label, value, conf]) => {
            const c = confidenceLabel(conf);
            return (
              <div key={label} className="rounded-md border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</p>
                <p className="font-mono text-lg font-black">{value}</p>
                <p className={cn('text-[10px] font-semibold', c.cls)}>{c.text}</p>
              </div>
            );
          })}
          <p className="col-span-2 text-[11px] text-white/40">
            Measured by running your code on inputs of {data.samples.length} growing sizes — not estimated. Fast linear
            scans can read as O(1) at small sizes.
          </p>
        </div>
      )}
      {state === 'unsupported' && <p className="mt-2 text-xs text-white/45">{reason}</p>}
      {state === 'error' && <p className="mt-2 text-xs text-red-300">Couldn&apos;t measure complexity. Try again.</p>}
    </div>
  );
}

function SubmitResultView({ data }: { data: SubmitResponse }) {
  // Compile errors aren't a per-test outcome — show them once, upfront.
  if (data.verdict === Verdict.COMPILE_ERROR) {
    return <CompileErrorBanner stderr={data.message || 'Compilation failed.'} />;
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <span
          className={cn(
            'rounded-md px-3 py-1 text-sm font-black uppercase tracking-[0.08em]',
            verdictChipClass(data.verdict),
          )}
        >
          {VERDICT_LABEL[data.verdict]}
        </span>
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-white/55">
          <span>
            {data.passedCount}/{data.totalCount} passed
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {data.runtimeMs} ms
          </span>
          {data.memoryKb !== null && (
            <span className="inline-flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              {Math.round(data.memoryKb / 1024)} MB
            </span>
          )}
        </div>
      </div>

      {data.message && (
        <pre className="overflow-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/35 p-3 font-mono text-xs text-red-200">
          {data.message}
        </pre>
      )}

      {data.results.length > 0 && (
        <div className="grid gap-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
            Per-test results (hidden inputs not shown)
          </p>
          <div className="grid gap-1">
            {data.results.map((result) => (
              <div
                key={result.index}
                className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5"
              >
                <span className="font-mono text-xs text-white/65">Test #{result.index + 1}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-white/40">{result.runtimeMs} ms</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]',
                      verdictChipClass(result.status),
                    )}
                  >
                    {VERDICT_LABEL[result.status]}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IoBlock({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">{label}</p>
      <pre
        className={cn(
          'overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/10 bg-black/35 p-2.5 font-mono text-xs leading-5 text-white/80',
          tone === 'ok' && 'border-emerald-500/25 text-emerald-100',
          tone === 'bad' && 'border-red-500/25 text-red-100',
        )}
      >
        {value === '' ? '(empty)' : value}
      </pre>
    </div>
  );
}

// --- Minimal markdown renderer (headings, lists, fenced code, inline code/bold) ---

type MdBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ordered'; items: string[] }
  | { type: 'unordered'; items: string[] }
  | { type: 'code'; code: string };

function parseMarkdown(content: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  let ordered: string[] = [];
  let unordered: string[] = [];
  let code: string[] | null = null;

  function flushParagraph() {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  }
  function flushLists() {
    if (ordered.length) blocks.push({ type: 'ordered', items: ordered });
    if (unordered.length) blocks.push({ type: 'unordered', items: unordered });
    ordered = [];
    unordered = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      if (code) {
        blocks.push({ type: 'code', code: code.join('\n') });
        code = null;
      } else {
        flushParagraph();
        flushLists();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      flushLists();
      continue;
    }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushLists();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      continue;
    }
    const orderedItem = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedItem) {
      flushParagraph();
      unordered = [];
      ordered.push(orderedItem[1]);
      continue;
    }
    const unorderedItem = trimmed.match(/^[-*]\s+(.+)$/);
    if (unorderedItem) {
      flushParagraph();
      ordered = [];
      unordered.push(unorderedItem[1]);
      continue;
    }
    paragraph.push(trimmed);
  }

  if (code) blocks.push({ type: 'code', code: code.join('\n') });
  flushParagraph();
  flushLists();
  return blocks;
}

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="rounded bg-black/35 px-1 py-0.5 font-mono text-[0.85em] text-white/90">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-black text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function Markdown({ content, className }: { content: string; className?: string }) {
  const blocks = parseMarkdown(content);
  return (
    <div className={cn('grid gap-3', className)}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <h2
              key={index}
              className={cn('font-black text-white', block.level <= 1 ? 'text-xl' : block.level === 2 ? 'text-lg' : 'text-base')}
            >
              {renderInline(block.text)}
            </h2>
          );
        }
        if (block.type === 'ordered') {
          return (
            <ol key={index} className="ml-5 grid list-decimal gap-1.5 text-sm leading-6 text-white/75">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === 'unordered') {
          return (
            <ul key={index} className="ml-5 grid list-disc gap-1.5 text-sm leading-6 text-white/75">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'code') {
          return (
            <pre
              key={index}
              className="overflow-auto rounded-md border border-white/10 bg-black/35 p-3 font-mono text-xs leading-5 text-white/80"
            >
              <code>{block.code}</code>
            </pre>
          );
        }
        return (
          <p key={index} className="text-sm leading-6 text-white/75">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
