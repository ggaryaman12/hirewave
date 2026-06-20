// Serializes native JS values to/builds the harness stdin/stdout convention.
// MUST stay in lockstep with lib/judge/harness/signature.ts:
//
//   stdin (args in signature order):
//     scalar  -> one line with the literal (bool: true/false)
//     T[]     -> one line, space-separated (empty array => one blank line)
//     int[][] -> a line with row count R, then R lines of space-separated ints
//   stdout (return value):
//     scalar  -> the literal; T[] -> space-separated; int[][] -> R lines

export function isArrayType(type) {
  return type.endsWith('[]');
}
export function is2DType(type) {
  return type.endsWith('[][]');
}

function scalarToken(type, value) {
  if (type.startsWith('bool')) return value ? 'true' : 'false';
  return String(value);
}

// Returns the stdin lines (array) for one argument.
export function serializeArgLines(type, value) {
  if (is2DType(type)) {
    const rows = value;
    const lines = [String(rows.length)];
    for (const row of rows) lines.push(row.map((x) => String(x)).join(' '));
    return lines;
  }
  if (isArrayType(type)) {
    return [value.map((x) => scalarToken(type, x)).join(' ')];
  }
  return [scalarToken(type, value)];
}

// Builds the full stdin string for an argument tuple in signature order.
export function buildStdin(params, args) {
  if (params.length !== args.length) {
    throw new Error(`arg count ${args.length} != param count ${params.length}`);
  }
  const lines = [];
  for (let i = 0; i < params.length; i += 1) {
    for (const line of serializeArgLines(params[i].type, args[i])) lines.push(line);
  }
  return `${lines.join('\n')}\n`;
}

// Serializes the reference return value to the expected stdout string
// (no trailing newline; whitespace comparison trims it anyway).
export function serializeReturn(returnType, value) {
  if (is2DType(returnType)) {
    return value.map((row) => row.map((x) => String(x)).join(' ')).join('\n');
  }
  if (isArrayType(returnType)) {
    return value.map((x) => scalarToken(returnType, x)).join(' ');
  }
  return scalarToken(returnType, value);
}

// Deterministic PRNG (mulberry32) so generated suites are reproducible.
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Helpers for generators.
export function randInt(r, lo, hi) {
  return lo + Math.floor(r() * (hi - lo + 1));
}
export function randArray(r, len, lo, hi) {
  return Array.from({ length: len }, () => randInt(r, lo, hi));
}
