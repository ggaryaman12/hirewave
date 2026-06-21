import { is2DType, isArrayType, type ParamType, type Signature } from '@/lib/judge/harness/signature';

// Generates a stdin payload of "size n" in the exact format the function-harness
// driver parses (one line per param; 2D = row-count line then rows). The first
// array/string param is the one scaled to n; other params get small fixed sizes.
// Used to measure how a submission's runtime/memory grow with input size.

function elementType(type: ParamType): 'int' | 'long' | 'double' | 'bool' | 'string' {
  return type.replace(/\[\]/g, '') as 'int' | 'long' | 'double' | 'bool' | 'string';
}

function isScalable(type: ParamType): boolean {
  return isArrayType(type) || type === 'string';
}

export function hasScalableParam(sig: Signature): boolean {
  return sig.params.some((p) => isScalable(p.type));
}

// Deterministic PRNG so a given (problem, n) always yields the same input.
function rng(seed: number): () => number {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function elementValue(elem: string, rand: () => number): string {
  if (elem === 'bool') return rand() < 0.5 ? 'true' : 'false';
  if (elem === 'string') return 'abcde';
  if (elem === 'double') return (rand() * 1000).toFixed(2);
  return String(Math.floor(rand() * 1000) + 1); // int / long
}

function arrayLine(elem: string, len: number, rand: () => number): string {
  const out: string[] = [];
  for (let i = 0; i < len; i += 1) out.push(elementValue(elem, rand));
  return out.join(' ');
}

const FIXED_SIZE = 4; // non-scaling array params

export function generateScaledInput(sig: Signature, n: number): string | null {
  if (!hasScalableParam(sig)) return null;
  const rand = rng(n + 1);
  const scaleIdx = sig.params.findIndex((p) => isScalable(p.type));
  const lines: string[] = [];

  sig.params.forEach((param, i) => {
    const size = i === scaleIdx ? n : FIXED_SIZE;
    const elem = elementType(param.type);
    if (is2DType(param.type)) {
      const rows = i === scaleIdx ? n : 2;
      lines.push(String(rows));
      for (let r = 0; r < rows; r += 1) lines.push(arrayLine('int', 3, rand));
    } else if (isArrayType(param.type)) {
      lines.push(arrayLine(elem, size, rand));
    } else if (param.type === 'string') {
      lines.push('a'.repeat(size));
    } else {
      lines.push(elementValue(param.type, rand));
    }
  });

  return `${lines.join('\n')}\n`;
}
