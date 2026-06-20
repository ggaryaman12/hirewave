// Design / OOD harness (LeetCode "design" problems): the candidate implements a
// class with a constructor + methods; a hidden driver replays a sequence of
// operations and prints each non-void return value.
//
// Scope: scalar argument/return types only (int/long/double/bool/string). That
// covers the common interview design problems (bank system, rate limiter, LRU
// with int keys, stock ledger). Array params are intentionally out of scope to
// keep the operation-line format unambiguous.
//
// stdin convention:
//   line 1: constructor args, space-separated in order (blank line if none)
//   line 2: Q  (number of operations)
//   next Q lines: "<methodName> <arg1> <arg2> ..."
// stdout convention:
//   one line per operation whose method returns non-void (bool -> true/false,
//   double -> 12 significant digits). void methods print nothing.

export type DesignScalar = 'int' | 'long' | 'double' | 'bool' | 'string';
export type DesignReturn = DesignScalar | 'void';

export type DesignParam = { name: string; type: DesignScalar };
export type DesignMethod = { name: string; params: DesignParam[]; returnType: DesignReturn };
export type DesignSpec = {
  className: string;
  constructorParams: DesignParam[];
  methods: DesignMethod[];
};

export type DesignLanguage = 'cpp' | 'java' | 'javascript';
export const DESIGN_LANGUAGES: DesignLanguage[] = ['cpp', 'java', 'javascript'];

export function parseDesignSpec(json: string | null | undefined): DesignSpec | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as DesignSpec;
    if (!parsed || typeof parsed.className !== 'string' || !Array.isArray(parsed.methods)) return null;
    if (!Array.isArray(parsed.constructorParams)) return null;
    return parsed;
  } catch {
    return null;
  }
}
