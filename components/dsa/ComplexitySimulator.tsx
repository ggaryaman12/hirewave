'use client';
import { useEffect, useRef, useState } from 'react';

interface Step {
  idx: number; lineNumber: number; recursionDepth: number;
  callStack: string[]; variables: Record<string, string>; note?: string;
}

const MAX_UI_STEPS = 2000;

export function ComplexitySimulator(props: {
  slug: string; analysisId: string; editorRef?: React.MutableRefObject<any>;
}) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(false);
  const decoRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const all: Step[] = [];
      let cursor: number | null = 0;
      while (cursor !== null && all.length < MAX_UI_STEPS) {
        const res: Response = await fetch(`/api/dsa/complexity-v2/${props.slug}/${props.analysisId}/simulation?cursor=${cursor}&limit=500`);
        const body = await res.json();
        all.push(...(body.steps ?? []));
        cursor = body.nextCursor ?? null;
      }
      if (!cancelled) { setSteps(all); setI(0); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [props.slug, props.analysisId]);

  useEffect(() => {
    const ed = props.editorRef?.current;
    const monaco = (window as any).monaco;
    if (!ed?.deltaDecorations || !monaco || !steps[i]) return;
    const line = steps[i].lineNumber;
    decoRef.current = ed.deltaDecorations(decoRef.current, [{
      range: new monaco.Range(line, 1, line, 1),
      options: { isWholeLine: true, className: 'cx-current' },
    }]);
    if (ed.revealLineInCenter) ed.revealLineInCenter(line);
    return () => { if (ed?.deltaDecorations) decoRef.current = ed.deltaDecorations(decoRef.current, []); };
  }, [i, steps, props.editorRef]);

  if (loading) return <div className="cx-sim">Loading simulation…</div>;
  if (!steps.length) return <div className="cx-sim cx-muted">No simulation steps (code may have errored or produced none).</div>;

  const s = steps[i];
  const clamp = (x: number) => Math.max(0, Math.min(steps.length - 1, x));

  return (
    <div className="cx-sim">
      <div className="cx-sim-ctrls">
        <button onClick={() => setI(0)} disabled={i === 0}>⏮</button>
        <button onClick={() => setI(clamp(i - 1))} disabled={i === 0}>◀</button>
        <span>Step {i + 1} / {steps.length} · line {s.lineNumber} · depth {s.recursionDepth}</span>
        <button onClick={() => setI(clamp(i + 1))} disabled={i === steps.length - 1}>▶</button>
        <button onClick={() => setI(steps.length - 1)} disabled={i === steps.length - 1}>⏭</button>
      </div>
      {s.callStack?.length > 0 && <div className="cx-stack">stack: {s.callStack.join(' › ')}</div>}
      {Object.keys(s.variables ?? {}).length > 0 && (
        <div className="cx-vars">{Object.entries(s.variables).map(([k, v]) => `${k} = ${v}`).join('\n')}</div>
      )}
      {s.note && <div className="cx-muted">{s.note}</div>}
    </div>
  );
}
