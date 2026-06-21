'use client';
import { useState } from 'react';
import './complexity-v2.css';

interface Summary {
  bigOTime: string; bigOSpace: string; confidence: number;
  explanation: string; suggestion?: string;
  hotspots: { line: number; share: number }[];
  staticGuess: { time: string; space: string };
}

export function ComplexityV2Panel(props: {
  slug: string; language: string; code: string;
  editorRef?: React.MutableRefObject<any>;
  onAnalyzed?: (analysisId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setLoading(true); setError(null); setSummary(null);
    try {
      const res = await fetch(`/api/dsa/complexity-v2/${props.slug}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ language: props.language, source: props.code }),
      });
      const body = await res.json();
      if (body.status === 'unsupported_language') { setError('The v2 analyzer supports JavaScript only.'); return; }
      if (!body.summary) { setError('Could not analyze this solution.'); return; }
      setSummary(body.summary);
      highlight(body.summary.hotspots ?? []);
      if (body.analysisId) props.onAnalyzed?.(body.analysisId);
    } catch {
      setError('Analysis failed.');
    } finally { setLoading(false); }
  }

  function highlight(hotspots: { line: number }[]) {
    const ed = props.editorRef?.current;
    const monaco = (window as any).monaco;
    if (!ed?.deltaDecorations || !monaco) return;
    ed.deltaDecorations([], hotspots.map((h) => ({
      range: new monaco.Range(h.line, 1, h.line, 1),
      options: { isWholeLine: true, className: 'cx-hotspot', glyphMarginClassName: 'cx-hot-glyph' },
    })));
  }

  const jsOnly = props.language.toLowerCase() === 'javascript';

  return (
    <div className="cx-panel">
      <div className="cx-head">
        <b>Analyzer v2 (experimental)</b>
        <button onClick={analyze} disabled={loading || !jsOnly}>
          {loading ? 'Analyzing…' : 'Analyze Complexity v2'}
        </button>
      </div>
      {!jsOnly && <p className="cx-muted">v2 supports JavaScript only (comparison build).</p>}
      {error && <p className="cx-err">{error}</p>}
      {summary && (
        <div className="cx-result">
          <div className="cx-bigo">
            <span>Time: <b>{summary.bigOTime}</b></span>
            <span>Space: <b>{summary.bigOSpace}</b></span>
            <span>Confidence: {(summary.confidence * 100).toFixed(0)}%</span>
          </div>
          <p>{summary.explanation}</p>
          {summary.staticGuess && (
            <p className="cx-muted">Static guess: {summary.staticGuess.time} time / {summary.staticGuess.space} space</p>
          )}
          {summary.suggestion && <p className="cx-suggest">💡 {summary.suggestion}</p>}
          {summary.hotspots?.length > 0 && (
            <p className="cx-hot">Hot lines: {summary.hotspots.map((h) => h.line).join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}
