// Generates test-case suites for the function-mode problem bank.
//
//   node scripts/dsa/generate.mjs
//
// For each problem: serialize the explicit samples + seeded generator inputs to
// the harness stdin convention, compute expected output by running the JS
// `reference`, and write scripts/dsa/generated/<slug>.json. Dedupes by stdin.
// Aborts on any reference error so a broken problem never reaches the DB.
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { PROBLEMS, TRACKS } from './problems.mjs';
import { buildStdin, rng, seedFromString, serializeReturn } from './lib/serialize.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'generated');

function makeCase(problem, args, isSample, sortOrder) {
  const input = buildStdin(problem.signature.params, args);
  const result = problem.reference(...args.map((a) => structuredCloneSafe(a)));
  const expected = serializeReturn(problem.signature.returnType, result);
  return { input, expected, isSample, sortOrder };
}

// reference must not mutate caller args across cases; clone defensively.
function structuredCloneSafe(v) {
  return Array.isArray(v) ? v.map(structuredCloneSafe) : v;
}

function buildProblem(problem) {
  const cases = [];
  const seen = new Set();
  let order = 0;

  for (const args of problem.samples) {
    const c = makeCase(problem, args, true, order);
    if (seen.has(c.input)) continue;
    seen.add(c.input);
    cases.push(c);
    order += 1;
  }

  const r = rng(seedFromString(problem.slug));
  const generators = problem.generators ?? [];
  let attempts = 0;
  const maxAttempts = (problem.hiddenCount ?? 20) * 40;
  while (cases.filter((c) => !c.isSample).length < (problem.hiddenCount ?? 20) && attempts < maxAttempts) {
    attempts += 1;
    const gen = generators[attempts % generators.length];
    const args = gen(r);
    const c = makeCase(problem, args, false, order);
    if (seen.has(c.input)) continue;
    seen.add(c.input);
    cases.push(c);
    order += 1;
  }

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
    functionName: problem.signature.functionName,
    signatureJson: JSON.stringify(problem.signature),
    comparison: problem.comparison ?? 'whitespace',
    floatEpsilon: problem.floatEpsilon ?? null,
    timeLimitMs: problem.timeLimitMs ?? 2000,
    memoryLimitMb: problem.memoryLimitMb ?? 256,
    testCases: cases,
  };
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const index = [];
  for (const problem of PROBLEMS) {
    let built;
    try {
      built = buildProblem(problem);
    } catch (err) {
      console.error(`FAILED generating ${problem.slug}: ${err.message}`);
      process.exit(1);
    }
    const sampleCount = built.testCases.filter((c) => c.isSample).length;
    const hiddenCount = built.testCases.length - sampleCount;
    if (sampleCount === 0) {
      console.error(`FAILED ${problem.slug}: no sample cases`);
      process.exit(1);
    }
    writeFileSync(join(OUT_DIR, `${built.slug}.json`), `${JSON.stringify(built, null, 2)}\n`, 'utf8');
    index.push({ slug: built.slug, sampleCount, hiddenCount });
    console.log(`  ${built.slug}: ${sampleCount} samples + ${hiddenCount} hidden`);
  }
  writeFileSync(join(OUT_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  writeFileSync(join(OUT_DIR, 'tracks.json'), `${JSON.stringify(TRACKS, null, 2)}\n`, 'utf8');
  console.log(`\nGenerated ${index.length} problems -> ${OUT_DIR}`);
}

main();
