'use client';

import { useState } from 'react';
import { Sparkles, Loader2, TrendingUp, AlertTriangle, Target } from 'lucide-react';

type AiAnalysis = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  generatedAt: string;
};

export function AiAnalysisPanel({ initial }: { initial: AiAnalysis | null }) {
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/ai-analysis', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || 'Analysis failed');
      } else {
        setAnalysis(body as AiAnalysis);
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-b from-[#f15a29]/[0.06] to-transparent p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-black">
          <Sparkles className="h-4 w-4 text-[#f15a29]" /> AI analysis
        </h3>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-[#f15a29] px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {analysis ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {!analysis && !error && (
        <p className="mt-3 text-sm text-white/45">
          Get a personalized read on your strengths, gaps, and what to practice next — generated from your real submission history.
        </p>
      )}

      {analysis && (
        <div className="mt-4 grid gap-4">
          <p className="text-sm leading-relaxed text-white/80">{analysis.summary}</p>
          {analysis.strengths.length > 0 && (
            <AnalysisList icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-300" />} title="Strengths" items={analysis.strengths} />
          )}
          {analysis.weaknesses.length > 0 && (
            <AnalysisList icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-300" />} title="Gaps" items={analysis.weaknesses} />
          )}
          {analysis.recommendations.length > 0 && (
            <AnalysisList icon={<Target className="h-3.5 w-3.5 text-[#f7a07f]" />} title="Do next" items={analysis.recommendations} />
          )}
          <p className="text-[10px] text-white/30">
            Generated {new Date(analysis.generatedAt).toLocaleString()} from your submission history.
          </p>
        </div>
      )}
    </div>
  );
}

function AnalysisList({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
        {icon} {title}
      </p>
      <ul className="mt-2 grid gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm text-white/75">
            <span className="text-white/30">·</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
