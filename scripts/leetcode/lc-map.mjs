// Maps LeetCode `metaData` types -> our harness ParamType. Returns null for any
// type our judge can't model (ListNode, TreeNode, char matrices, etc.) so those
// problems are skipped rather than imported broken.
//
// PERSONAL-STUDY TOOL. Fetches copyrighted LeetCode content via their GraphQL
// API (against their ToS). Do not redistribute or ship imported statements in a
// commercial product.

const TYPE_MAP = {
  integer: 'int',
  'integer[]': 'int[]',
  'integer[][]': 'int[][]',
  long: 'long',
  'long[]': 'long[]',
  double: 'double',
  'double[]': 'double[]',
  boolean: 'bool',
  'boolean[]': 'bool[]',
  string: 'string',
  'string[]': 'string[]',
  character: 'string',
  'list<integer>': 'int[]',
  'list<long>': 'long[]',
  'list<double>': 'double[]',
  'list<boolean>': 'bool[]',
  'list<string>': 'string[]',
  'list<list<integer>>': 'int[][]',
};

export function mapLcType(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase().replace(/\s+/g, '');
  return TYPE_MAP[t] ?? null;
}

// metaData -> our Signature, or { unsupported: [types] } if anything can't map.
export function metaToSignature(metaData) {
  let meta;
  try {
    meta = typeof metaData === 'string' ? JSON.parse(metaData) : metaData;
  } catch {
    return { error: 'bad metaData json' };
  }
  if (!meta || !meta.name || !Array.isArray(meta.params) || !meta.return) {
    return { error: 'design/class or non-standard metaData' };
  }

  const unsupported = [];
  const params = meta.params.map((p) => {
    const type = mapLcType(p.type);
    if (!type) unsupported.push(p.type);
    return { name: p.name, type };
  });
  const returnType = mapLcType(meta.return.type);
  if (!returnType) unsupported.push(meta.return.type);

  if (unsupported.length) return { unsupported };
  return { signature: { functionName: meta.name, params, returnType } };
}
