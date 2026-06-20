// Parses LeetCode sample I/O into our harness test-case format.
//   inputs  <- exampleTestcases (machine format: one JSON literal per param,
//              params.length lines per case)
//   expected<- parsed from the statement HTML examples ("Output: ...")
// Reuses serialize.mjs so native values become harness stdin/expected strings.
import { buildStdin, serializeReturn } from '../dsa/lib/serialize.mjs';

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// Ordered list of "Output:" values from the statement (tags stripped).
export function parseExpectedOutputs(content) {
  const text = decodeEntities(content.replace(/<[^>]+>/g, ' '));
  const out = [];
  const re = /Output:\s*(.*?)\s*(?:Explanation|Example|Constraints|Input:|$)/gis;
  let m;
  while ((m = re.exec(text)) !== null) {
    const v = m[1].trim();
    if (v) out.push(v);
  }
  return out;
}

// exampleTestcases -> array of native arg tuples (one per case).
export function parseInputCases(exampleTestcases, paramCount) {
  const lines = String(exampleTestcases).split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (paramCount <= 0 || lines.length % paramCount !== 0) return null;
  const cases = [];
  for (let i = 0; i < lines.length; i += paramCount) {
    const args = [];
    for (let j = 0; j < paramCount; j += 1) {
      try {
        args.push(JSON.parse(lines[i + j]));
      } catch {
        return null; // unparseable literal
      }
    }
    cases.push(args);
  }
  return cases;
}

// Builds harness-format sample test cases. Returns { samples } or { error }.
export function buildSamples(signature, exampleTestcases, content) {
  const inputs = parseInputCases(exampleTestcases, signature.params.length);
  if (!inputs) return { error: 'could not parse example inputs' };
  const expectedRaw = parseExpectedOutputs(content);
  if (expectedRaw.length < inputs.length) {
    return { error: `expected count ${expectedRaw.length} < input cases ${inputs.length}` };
  }

  const samples = [];
  for (let i = 0; i < inputs.length; i += 1) {
    let expectedVal;
    try {
      expectedVal = JSON.parse(expectedRaw[i]);
    } catch {
      return { error: `unparseable expected: ${expectedRaw[i].slice(0, 40)}` };
    }
    let input;
    let expected;
    try {
      input = buildStdin(signature.params, inputs[i]);
      expected = serializeReturn(signature.returnType, expectedVal);
    } catch (err) {
      return { error: `serialize failed: ${err.message}` };
    }
    samples.push({ input, expected, isSample: true, sortOrder: i });
  }
  return { samples };
}
