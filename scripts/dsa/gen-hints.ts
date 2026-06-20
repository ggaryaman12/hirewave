/* eslint-disable no-console */
// Backfills 2-3 original, progressive hints for problems that have none, reusing
// THIS PROJECT'S configured LLM (the same env the assessment assistant uses).
// Hints are ORIGINAL (model-written), so no copyright concern for imports.
//
//   npx tsx scripts/dsa/gen-hints.ts [--limit N] [--status review|published] [--slug <slug>]
//
// Provider follows AI_PROVIDER in .env:
//   openai-compatible (default) -> AI_BASE_URL + AI_API_KEY + AI_MODEL  (NVIDIA Build / OpenAI)
//   ollama                      -> OLLAMA_BASE_URL + OLLAMA_MODEL       (Yelo AI: http://yeloai.yelo.solutions)
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

// Load .env so the project's existing AI config (AI_API_KEY, OLLAMA_BASE_URL, …)
// is available without exporting anything by hand. Does not overwrite vars that
// are already set in the environment.
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

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 30000);

type Provider = 'ollama' | 'openai';

const SYSTEM =
  'You write concise, ORIGINAL, progressive hints for a coding problem. Return ONLY a JSON array of 2-3 short strings, each nudging toward the solution without giving full code. No markdown, no preamble.';

function userPrompt(statement: string) {
  return `Problem statement:\n\n${statement}\n\nReturn the JSON array of hints.`;
}

function extractHints(text: string): string[] {
  const cleaned = text.replace(/```json|```/g, '').trim();
  // Be lenient: grab the first JSON array if the model added prose.
  const match = cleaned.match(/\[[\s\S]*\]/);
  const parsed = JSON.parse(match ? match[0] : cleaned);
  if (!Array.isArray(parsed)) throw new Error('model did not return a JSON array');
  return parsed.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean).slice(0, 3);
}

const MAX_ATTEMPTS = Number(process.env.AI_HINTS_MAX_ATTEMPTS || 5);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withTimeout(p: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await p(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

// Retries on HTTP 429 / 5xx with exponential backoff + jitter. Honors a
// Retry-After header when present (common on 429).
async function requestWithRetry(send: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      const retryAfter = last?.headers.get('retry-after');
      const wait = retryAfter ? Number(retryAfter) * 1000 : Math.min(15000, 800 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 400);
      await sleep(wait);
    }
    const res = await withTimeout(send);
    if (res.status !== 429 && res.status < 500) return res;
    last = res;
  }
  return last as Response;
}

// ---- openai-compatible (NVIDIA Build / OpenAI / any /chat/completions) ----
async function callOpenAiCompatible(statement: string): Promise<string[]> {
  const baseUrl = (process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || '').replace(/\/+$/, '');
  const apiKey = process.env.AI_API_KEY || process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY || '';
  const model = process.env.AI_MODEL || 'meta/llama-3.1-8b-instruct';
  if (!baseUrl || !apiKey) throw new Error('AI_BASE_URL / AI_API_KEY not set');

  const res = await requestWithRetry((signal) =>
    fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userPrompt(statement) }],
        temperature: 0.4,
        max_tokens: 400,
      }),
      signal,
    }),
  );
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return extractHints(data.choices?.[0]?.message?.content || '');
}

// ---- ollama (Yelo AI) ----
async function callOllama(statement: string): Promise<string[]> {
  const baseUrl = (process.env.OLLAMA_BASE_URL || '').replace(/\/+$/, '');
  const model = process.env.OLLAMA_MODEL || process.env.OLLAMA_GENERATE_MODEL || '';
  if (!baseUrl || !model) throw new Error('OLLAMA_BASE_URL / OLLAMA_MODEL not set');

  const res = await requestWithRetry((signal) =>
    fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userPrompt(statement) }],
        options: { temperature: 0.4 },
      }),
      signal,
    }),
  );
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { message?: { content?: string } };
  return extractHints(data.message?.content || '');
}

function generateHints(provider: Provider, statement: string): Promise<string[]> {
  return provider === 'ollama' ? callOllama(statement) : callOpenAiCompatible(statement);
}

// Resolves the --provider flag (default: AI_PROVIDER). 'both' alternates the two
// endpoints per problem to split load across Yelo (ollama) + NVIDIA (openai).
function resolveMode(args: string[]): 'ollama' | 'openai' | 'both' {
  const i = args.indexOf('--provider');
  const raw = (i >= 0 ? args[i + 1] : process.env.AI_PROVIDER || 'openai-compatible').toLowerCase();
  if (raw === 'both') return 'both';
  if (raw === 'ollama') return 'ollama';
  return 'openai'; // openai-compatible / nvidia / openai
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : 50;
  const statusIdx = args.indexOf('--status');
  const status = statusIdx >= 0 ? args[statusIdx + 1] : undefined;
  const slugIdx = args.indexOf('--slug');
  const slug = slugIdx >= 0 ? args[slugIdx + 1] : undefined;
  const delayMs = args.includes('--delay') ? Number(args[args.indexOf('--delay') + 1]) : 600;
  const mode = resolveMode(args);

  const problems = await prisma.dsaProblem.findMany({
    where: { hintsJson: null, ...(status ? { status } : {}), ...(slug ? { slug } : {}) },
    select: { id: true, slug: true, statementMd: true },
    take: limit,
  });
  console.log(`Mode=${mode}. Generating hints for ${problems.length} problems...`);

  let done = 0;
  for (let idx = 0; idx < problems.length; idx += 1) {
    const p = problems[idx];
    // 'both' alternates Yelo/NVIDIA per problem to spread the load.
    const provider: Provider = mode === 'both' ? (idx % 2 === 0 ? 'ollama' : 'openai') : mode;
    try {
      const hints = await generateHints(provider, p.statementMd);
      if (hints.length) {
        await prisma.dsaProblem.update({ where: { id: p.id }, data: { hintsJson: JSON.stringify(hints) } });
        done += 1;
        console.log(`  ✓ ${p.slug} [${provider}] (${hints.length} hints)`);
      } else {
        console.warn(`  skip ${p.slug}: model returned no hints`);
      }
    } catch (err) {
      console.warn(`  skip ${p.slug} [${provider}]: ${err instanceof Error ? err.message : err}`);
    }
    if (delayMs > 0 && idx < problems.length - 1) await sleep(delayMs);
  }
  console.log(`Done. Added hints to ${done}/${problems.length} problems.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
