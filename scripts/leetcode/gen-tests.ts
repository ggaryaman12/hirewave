/* eslint-disable no-console */
// PHASE 2 — synthesize a hidden test suite for imported (sample-only) function
// problems, using a VALIDATED LLM reference.
//
//   npx tsx scripts/leetcode/gen-tests.ts [--limit N] [--count 30] [--provider both]
//
// Per problem:
//   1. Ask the LLM for a JS `reference` solution + a constraint-respecting
//      `generator(rand)` (reads statement + signature + real samples).
//   2. VALIDATE the reference against the REAL LeetCode samples through the
//      actual harness + local provider. This also rejects order-dependent /
//      judge-unsafe problems (reference order != sample order => fails => skip).
//   3. If valid, run reference+generator in an isolated node subprocess to emit
//      fresh (input, expected) cases; dedupe vs samples; store as hidden.
//
// Hidden tests are AI-synthesized (best-effort), clearly marked. Only problems
// whose reference reproduces every real sample get a hidden suite.
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { LocalJudgeProvider } from '../../lib/judge/local-provider';
import { wrapSource, parseSignature, type Signature } from '../../lib/judge/harness';
import { compareOutput } from '../../lib/judge/compare';

function loadDotenv() {
  const path = join(process.cwd(), '.env');
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotenv();

const prisma = new PrismaClient();
const provider = new LocalJudgeProvider();
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 60000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// serialize.mjs source, inlined (exports stripped) into the generation program
// so the isolated subprocess can build harness stdin/expected itself.
const SERIALIZE_SRC = readFileSync(join(process.cwd(), 'scripts/dsa/lib/serialize.mjs'), 'utf8').replace(/export\s+/g, '');

type Provider = 'ollama' | 'openai';
function resolveMode(args: string[]): 'ollama' | 'openai' | 'both' {
  const i = args.indexOf('--provider');
  const raw = (i >= 0 ? args[i + 1] : process.env.AI_PROVIDER || 'openai-compatible').toLowerCase();
  if (raw === 'both') return 'both';
  if (raw === 'ollama') return 'ollama';
  return 'openai';
}

async function callLLM(provider: Provider, prompt: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    if (provider === 'ollama') {
      const baseUrl = (process.env.OLLAMA_BASE_URL || '').replace(/\/+$/, '');
      const model = process.env.OLLAMA_MODEL || '';
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, stream: false, messages: [{ role: 'user', content: prompt }], options: { temperature: 0.2 } }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Ollama ${res.status}`);
      return ((await res.json()) as { message?: { content?: string } }).message?.content || '';
    }
    const baseUrl = (process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || '').replace(/\/+$/, '');
    const apiKey = process.env.AI_API_KEY || process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY || '';
    const model = process.env.AI_MODEL || 'meta/llama-3.1-8b-instruct';
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 1200 }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    return ((await res.json()) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

function buildPrompt(statement: string, sig: Signature, samples: { input: string; expected: string }[]): string {
  return `You are given a coding problem. Write a CORRECT JavaScript reference solution and a random input generator.

SIGNATURE (JSON): ${JSON.stringify(sig)}

HARNESS I/O (must match): args are passed in signature order. The generator returns the argument list as a JS array in that order, using NATIVE JS values (numbers, strings, booleans, arrays). Respect the problem constraints so inputs are always valid.

PROBLEM STATEMENT:
${statement.slice(0, 2500)}

Return ONLY a JSON object, no markdown, with two string fields:
{"reference": "function ${sig.functionName}(...) { ... }", "generator": "function gen(rand){ /* rand() -> [0,1). return [arg1, arg2, ...] */ }"}
The reference MUST be named exactly ${sig.functionName}. The generator MUST be named gen and take a single rand function. Keep generated inputs small (arrays <= 12, values modest).`;
}

function extractJson(text: string): { reference: string; generator: string } | null {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    if (typeof obj.reference === 'string' && typeof obj.generator === 'string') return obj;
  } catch {
    /* fall through */
  }
  return null;
}

async function validateReference(sig: Signature, reference: string, samples: { input: string; expected: string }[]): Promise<boolean> {
  if (samples.length === 0) return false;
  const source = wrapSource('javascript', sig, reference);
  for (const s of samples) {
    const run = await provider.run({ language: 'javascript', source, stdin: s.input, timeLimitMs: 5000, memoryLimitMb: 256 });
    if (run.status !== 'ok' || !compareOutput(s.expected, run.stdout, 'whitespace')) return false;
  }
  return true;
}

async function generateHidden(sig: Signature, reference: string, generator: string, count: number, seed: number): Promise<{ input: string; expected: string }[]> {
  const program = `${SERIALIZE_SRC}
${reference}
${generator}
const _sig = ${JSON.stringify(sig)};
const _rand = rng(${seed});
const _out = [];
for (let _i = 0; _i < ${count * 3} && _out.length < ${count}; _i++) {
  try {
    const _args = gen(_rand);
    if (!Array.isArray(_args) || _args.length !== _sig.params.length) continue;
    const _res = ${sig.functionName}(..._args.map((a) => Array.isArray(a) ? JSON.parse(JSON.stringify(a)) : a));
    _out.push({ input: buildStdin(_sig.params, _args), expected: serializeReturn(_sig.returnType, _res) });
  } catch (e) { /* skip bad gen */ }
}
console.log(JSON.stringify(_out));`;
  const run = await provider.run({ language: 'javascript', source: program, stdin: '', timeLimitMs: 15000, memoryLimitMb: 512 });
  if (run.status !== 'ok') return [];
  try {
    return JSON.parse(run.stdout.trim());
  } catch {
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : 50;
  const count = args.includes('--count') ? Number(args[args.indexOf('--count') + 1]) : 30;
  const mode = resolveMode(args);

  // LeetCode-imported function problems that currently have only sample cases.
  const track = await prisma.dsaTrack.findUnique({ where: { slug: 'leetcode-personal' } });
  if (!track) { console.log('no leetcode-personal track; import first.'); await prisma.$disconnect(); return; }

  const problems = await prisma.dsaProblem.findMany({
    where: { topic: { trackId: track.id }, kind: 'function', signatureJson: { not: null } },
    select: { id: true, slug: true, statementMd: true, signatureJson: true, testCases: { select: { input: true, expected: true, isSample: true } } },
    take: limit,
  });
  const todo = problems.filter((p) => p.testCases.every((t) => t.isSample));
  console.log(`Mode=${mode}. ${todo.length} problems to expand (count=${count} hidden each)...`);

  let expanded = 0;
  for (let idx = 0; idx < todo.length; idx += 1) {
    const p = todo[idx];
    const provider2: Provider = mode === 'both' ? (idx % 2 === 0 ? 'ollama' : 'openai') : mode;
    const sig = parseSignature(p.signatureJson);
    if (!sig) { console.log(`  - ${p.slug}: bad signature`); continue; }
    const samples = p.testCases.filter((t) => t.isSample).map((t) => ({ input: t.input, expected: t.expected }));
    try {
      const text = await callLLM(provider2, buildPrompt(p.statementMd, sig, samples));
      const parsed = extractJson(text);
      if (!parsed) { console.log(`  - ${p.slug} [${provider2}]: no JSON ref/gen`); continue; }

      const valid = await validateReference(sig, parsed.reference, samples);
      if (!valid) { console.log(`  - ${p.slug} [${provider2}]: reference failed samples (skipped, keeps samples)`); continue; }

      const seen = new Set(samples.map((s) => s.input));
      const hidden = (await generateHidden(sig, parsed.reference, parsed.generator, count, 12345 + idx)).filter((c) => c.input && !seen.has(c.input));
      if (hidden.length === 0) { console.log(`  - ${p.slug}: generator produced nothing`); continue; }

      let order = p.testCases.length;
      for (const c of hidden) {
        await prisma.dsaTestCase.create({ data: { problemId: p.id, input: c.input, expected: c.expected, isSample: false, sortOrder: order++ } });
      }
      expanded += 1;
      console.log(`  ✓ ${p.slug} [${provider2}] +${hidden.length} hidden`);
    } catch (err) {
      console.log(`  ! ${p.slug} [${provider2}]: ${err instanceof Error ? err.message : err}`);
    }
    await sleep(500);
  }
  console.log(`\nDone. Expanded ${expanded}/${todo.length}.`);
  await prisma.$disconnect();
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
