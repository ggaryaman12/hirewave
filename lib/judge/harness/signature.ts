// Function-signature model (LeetCode-style): the candidate writes only the
// function body; a hidden per-language driver parses typed inputs from stdin,
// calls the function, and prints the return value in a canonical form.

export type ParamType =
  | 'int'
  | 'long'
  | 'double'
  | 'bool'
  | 'string'
  | 'int[]'
  | 'long[]'
  | 'double[]'
  | 'bool[]'
  | 'string[]'
  | 'int[][]';

export type SignatureParam = { name: string; type: ParamType };

export type Signature = {
  functionName: string;
  params: SignatureParam[];
  returnType: ParamType;
};

export type HarnessLanguage = 'cpp' | 'java' | 'javascript';

export const SUPPORTED_LANGUAGES: HarnessLanguage[] = ['cpp', 'java', 'javascript'];

export const LANGUAGE_LABELS: Record<HarnessLanguage, string> = {
  cpp: 'C++',
  java: 'Java',
  javascript: 'JavaScript',
};

export function parseSignature(json: string | null | undefined): Signature | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Signature;
    if (!parsed || typeof parsed.functionName !== 'string' || !Array.isArray(parsed.params)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isArrayType(type: ParamType) {
  return type.endsWith('[]');
}

export function is2DType(type: ParamType) {
  return type.endsWith('[][]');
}

// Input convention (stdin), arguments in signature order:
//   scalar       -> one line with the literal (bool: true/false)
//   T[]          -> one line, space-separated elements (blank line = empty)
//   int[][]      -> a line with row count R, then R lines of space-separated ints
// Return convention (stdout):
//   scalar       -> the literal; T[] -> space-separated; int[][] -> R lines
