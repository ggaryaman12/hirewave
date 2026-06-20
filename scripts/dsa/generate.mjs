// Generates test-case suites for the function-mode + design problem banks.
//
//   node scripts/dsa/generate.mjs
//
// function problems: serialize samples + seeded generator inputs to the harness
//   stdin convention; expected output = JS `reference`.
// design problems: serialize sample + generated OPERATION sequences; expected
//   output = simulate the JS `factory` object over the operations.
// Dedupes by stdin. Aborts on any reference error so a broken problem never
// reaches the DB.
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { PROBLEMS, TRACKS } from './problems.mjs';
import { RW_DESIGN_PROBLEMS, RW_FUNCTION_PROBLEMS, RW_TRACKS } from './realworld-problems.mjs';
import { buildStdin, rng, seedFromString, serializeReturn } from './lib/serialize.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'generated');

function structuredCloneSafe(v) {
  return Array.isArray(v) ? v.map(structuredCloneSafe) : v;
}

function scalarToken(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

// ---- function problems -------------------------------------------------
function makeFnCase(problem, args, isSample, sortOrder) {
  const input = buildStdin(problem.signature.params, args);
  const result = problem.reference(...args.map(structuredCloneSafe));
  const expected = serializeReturn(problem.signature.returnType, result);
  return { input, expected, isSample, sortOrder };
}

function buildFunctionProblem(problem) {
  const cases = [];
  const seen = new Set();
  let order = 0;

  for (const args of problem.samples) {
    const c = makeFnCase(problem, args, true, order);
    if (seen.has(c.input)) continue;
    seen.add(c.input); cases.push(c); order += 1;
  }

  const r = rng(seedFromString(problem.slug));
  const generators = problem.generators ?? [];
  const target = problem.hiddenCount ?? 20;
  let attempts = 0;
  const maxAttempts = target * 40;
  while (cases.filter((c) => !c.isSample).length < target && attempts < maxAttempts) {
    attempts += 1;
    const args = generators[attempts % generators.length](r);
    const c = makeFnCase(problem, args, false, order);
    if (seen.has(c.input)) continue;
    seen.add(c.input); cases.push(c); order += 1;
  }

  return baseRecord(problem, {
    kind: 'function',
    functionName: problem.signature.functionName,
    signatureJson: JSON.stringify(problem.signature),
    designSpecJson: null,
    testCases: cases,
  });
}

// ---- design problems ---------------------------------------------------
function buildDesignStdin(spec, ctorArgs, ops) {
  const lines = [];
  lines.push(ctorArgs.map(scalarToken).join(' '));
  lines.push(String(ops.length));
  for (const op of ops) lines.push([op.name, ...op.args.map(scalarToken)].join(' '));
  return `${lines.join('\n')}\n`;
}

function simulateDesign(spec, factory, ctorArgs, ops) {
  const obj = factory(...ctorArgs.map(structuredCloneSafe));
  const returnOf = Object.fromEntries(spec.methods.map((m) => [m.name, m.returnType]));
  const out = [];
  for (const op of ops) {
    const res = obj[op.name](...op.args.map(structuredCloneSafe));
    const rt = returnOf[op.name];
    if (rt && rt !== 'void') out.push(rt === 'bool' ? (res ? 'true' : 'false') : String(res));
  }
  return out.join('\n');
}

function makeDesignCase(problem, seq, isSample, sortOrder) {
  const input = buildDesignStdin(problem.designSpec, seq.ctorArgs, seq.ops);
  const expected = simulateDesign(problem.designSpec, problem.factory, seq.ctorArgs, seq.ops);
  return { input, expected, isSample, sortOrder };
}

function buildDesignProblem(problem) {
  const cases = [];
  const seen = new Set();
  let order = 0;

  for (const seq of problem.samples) {
    const c = makeDesignCase(problem, seq, true, order);
    if (seen.has(c.input)) continue;
    seen.add(c.input); cases.push(c); order += 1;
  }

  const r = rng(seedFromString(problem.slug));
  const generators = problem.opGenerators ?? [];
  const target = problem.hiddenCount ?? 20;
  let attempts = 0;
  const maxAttempts = target * 40;
  while (cases.filter((c) => !c.isSample).length < target && attempts < maxAttempts) {
    attempts += 1;
    const seq = generators[attempts % generators.length](r);
    const c = makeDesignCase(problem, seq, false, order);
    if (seen.has(c.input)) continue;
    seen.add(c.input); cases.push(c); order += 1;
  }

  return baseRecord(problem, {
    kind: 'design',
    functionName: null,
    signatureJson: null,
    designSpecJson: JSON.stringify(problem.designSpec),
    testCases: cases,
  });
}

// ---- shared ------------------------------------------------------------
function baseRecord(problem, extra) {
  return {
    slug: problem.slug,
    title: problem.title,
    track: problem.track,
    topic: problem.topic,
    difficulty: problem.difficulty,
    statementMd: problem.statementMd,
    constraintsMd: problem.constraintsMd ?? null,
    inputFormat: problem.inputFormat ?? null,
    outputFormat: problem.outputFormat ?? null,
    comparison: problem.comparison ?? 'whitespace',
    floatEpsilon: problem.floatEpsilon ?? null,
    timeLimitMs: problem.timeLimitMs ?? 2000,
    memoryLimitMb: problem.memoryLimitMb ?? 256,
    categoryTags: problem.categoryTags ?? [],
    companyTags: problem.companyTags ?? [],
    hints: problem.hints ?? [],
    ...extra,
  };
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const index = [];
  const all = [
    ...PROBLEMS.map((p) => ({ p, build: buildFunctionProblem })),
    ...RW_FUNCTION_PROBLEMS.map((p) => ({ p, build: buildFunctionProblem })),
    ...RW_DESIGN_PROBLEMS.map((p) => ({ p, build: buildDesignProblem })),
  ];

  for (const { p, build } of all) {
    let built;
    try {
      built = build(p);
    } catch (err) {
      console.error(`FAILED generating ${p.slug}: ${err.message}`);
      process.exit(1);
    }
    const sampleCount = built.testCases.filter((c) => c.isSample).length;
    const hiddenCount = built.testCases.length - sampleCount;
    if (sampleCount === 0) {
      console.error(`FAILED ${p.slug}: no sample cases`);
      process.exit(1);
    }
    writeFileSync(join(OUT_DIR, `${built.slug}.json`), `${JSON.stringify(built, null, 2)}\n`, 'utf8');
    index.push({ slug: built.slug, kind: built.kind, sampleCount, hiddenCount });
    console.log(`  [${built.kind}] ${built.slug}: ${sampleCount} samples + ${hiddenCount} hidden`);
  }

  writeFileSync(join(OUT_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  writeFileSync(join(OUT_DIR, 'tracks.json'), `${JSON.stringify([...TRACKS, ...RW_TRACKS], null, 2)}\n`, 'utf8');
  console.log(`\nGenerated ${index.length} problems -> ${OUT_DIR}`);
}

main();
