import * as acorn from 'acorn';
import type { BigO, StaticResult } from '@/lib/complexity/types';

type Node = acorn.Node & Record<string, any>;

// Detect i*=2 / i/=2 style halving update => logarithmic loop.
function isHalvingLoop(node: Node): boolean {
  const u = node.update;
  if (!u) return false;
  if (u.type === 'AssignmentExpression' && (u.operator === '*=' || u.operator === '/=')) return true;
  if (u.type === 'AssignmentExpression' && u.operator === '=' &&
      u.right?.type === 'BinaryExpression' && (u.right.operator === '*' || u.right.operator === '/')) return true;
  return false;
}

const LOOP_TYPES = new Set(['ForStatement', 'WhileStatement', 'DoWhileStatement', 'ForOfStatement', 'ForInStatement']);

export function analyzeStaticJs(code: string): StaticResult {
  let ast: Node;
  try {
    ast = acorn.parse(code, { ecmaVersion: 2022, locations: true }) as unknown as Node;
  } catch {
    return { guessTime: 'unknown', guessSpace: 'unknown', lowConfidence: true, annotations: [], recursive: false, maxLoopDepth: 0 };
  }

  const fnNames = new Set<string>();
  (function collect(n: Node) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'FunctionDeclaration' && n.id) fnNames.add(n.id.name);
    for (const k of Object.keys(n)) {
      const c = (n as any)[k];
      if (Array.isArray(c)) c.forEach((x) => x && x.type && collect(x));
      else if (c && c.type) collect(c);
    }
  })(ast);

  let maxLoopDepth = 0;
  let hasLog = false;
  let recursive = false;
  let nestedLoopWithCompare = false;

  (function walk(n: Node, loopDepth: number) {
    if (!n || typeof n.type !== 'string') return;
    let depth = loopDepth;
    if (LOOP_TYPES.has(n.type)) {
      depth = loopDepth + 1;
      maxLoopDepth = Math.max(maxLoopDepth, depth);
      if (n.type === 'ForStatement' && isHalvingLoop(n)) hasLog = true;
    }
    if (n.type === 'CallExpression') {
      const callee = n.callee;
      if (callee?.type === 'Identifier' && fnNames.has(callee.name)) recursive = true; // approx self/mutual recursion
      // 2-sum smell: nested loops comparing array elements
    }
    if (depth >= 2 && n.type === 'BinaryExpression' && (n.operator === '===' || n.operator === '==')) nestedLoopWithCompare = true;
    for (const k of Object.keys(n)) {
      const c = (n as any)[k];
      if (Array.isArray(c)) c.forEach((x) => x && x.type && walk(x, depth));
      else if (c && c.type) walk(c, depth);
    }
  })(ast, 0);

  let guessTime: BigO = 'O(1)';
  if (recursive) guessTime = 'unknown';            // resolved by dynamic pass
  else if (maxLoopDepth >= 3) guessTime = 'O(n^3)';
  else if (maxLoopDepth === 2) guessTime = 'O(n^2)';
  else if (maxLoopDepth === 1) guessTime = hasLog ? 'O(log n)' : 'O(n)';
  else if (hasLog) guessTime = 'O(log n)';

  const result: StaticResult = {
    guessTime,
    guessSpace: 'unknown',
    lowConfidence: recursive,
    annotations: [],
    recursive,
    maxLoopDepth,
  };
  if (nestedLoopWithCompare) result.suggestion = 'Nested loops doing element comparisons — a hash map can often drop this to O(n).';
  return result;
}
