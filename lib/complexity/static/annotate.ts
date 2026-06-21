import * as acorn from 'acorn';
import type { BigO, LineAnnotation, StaticResult } from '@/lib/complexity/types';

type Node = acorn.Node & Record<string, any>;
const LOOP_TYPES = new Set(['ForStatement', 'WhileStatement', 'DoWhileStatement', 'ForOfStatement', 'ForInStatement']);

const TIME_BY_DEPTH: BigO[] = ['O(1)', 'O(n)', 'O(n^2)', 'O(n^3)'];

export function annotateLines(code: string, base: StaticResult): { annotations: LineAnnotation[]; guessSpace: BigO } {
  let ast: Node;
  try { ast = acorn.parse(code, { ecmaVersion: 2022, locations: true }) as unknown as Node; }
  catch { return { annotations: [], guessSpace: 'unknown' }; }

  const byLine = new Map<number, { depth: number; alloc: boolean; inRec: boolean }>();
  let pushInLoop = false;

  (function walk(n: Node, depth: number, inRec: boolean) {
    if (!n || typeof n.type !== 'string') return;
    let d = depth;
    if (LOOP_TYPES.has(n.type)) d = depth + 1;
    const line: number | undefined = n.loc?.start?.line;
    let alloc = false;
    if (n.type === 'ArrayExpression' || n.type === 'ObjectExpression') alloc = true;
    if (n.type === 'NewExpression') alloc = true;
    if (n.type === 'CallExpression' && n.callee?.type === 'MemberExpression' &&
        n.callee.property?.name === 'push' && d >= 1) pushInLoop = true;
    if (line !== undefined) {
      const prev = byLine.get(line) ?? { depth: 0, alloc: false, inRec: false };
      byLine.set(line, { depth: Math.max(prev.depth, d), alloc: prev.alloc || alloc, inRec: prev.inRec || inRec });
    }
    for (const k of Object.keys(n)) {
      const c = (n as any)[k];
      if (Array.isArray(c)) c.forEach((x) => x && x.type && walk(x, d, inRec || base.recursive));
      else if (c && c.type) walk(c, d, inRec || base.recursive);
    }
  })(ast, 0, false);

  const annotations: LineAnnotation[] = [];
  for (const [line, info] of [...byLine.entries()].sort((a, b) => a[0] - b[0])) {
    const tf = TIME_BY_DEPTH[Math.min(info.depth, 3)];
    annotations.push({
      line,
      executed: info.depth === 0 ? '~1 time' : info.depth === 1 ? '~n times' : `~n^${info.depth} times`,
      timeFactor: base.recursive ? 'unknown' : tf,
      spaceImpact: info.alloc ? (info.depth >= 1 ? 'O(n)' : 'O(1)') : 'none',
      note: info.depth >= 2 ? 'inside nested loop' : info.depth === 1 ? 'inside loop' : '',
      inLoop: info.depth >= 1,
      inRecursion: info.inRec,
    });
  }
  const guessSpace: BigO = pushInLoop ? 'O(n)' : 'O(1)';
  return { annotations, guessSpace };
}
