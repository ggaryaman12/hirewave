/* eslint-disable no-console */
// Backfills 2-3 original, progressive hints for problems that have none, using
// an OpenAI-compatible chat endpoint. Hints are ORIGINAL (model-written), so no
// copyright concern even for imported problems.
//
//   AI_HINTS_BASE_URL=https://api.openai.com/v1 \
//   AI_HINTS_API_KEY=sk-... \
//   AI_HINTS_MODEL=gpt-4o-mini \
//   npx tsx scripts/dsa/gen-hints.ts [--limit N] [--status review|published]
//
// No endpoint configured -> prints setup help and exits 0 (safe no-op).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE_URL = process.env.AI_HINTS_BASE_URL || process.env.OPENAI_BASE_URL || '';
const API_KEY = process.env.AI_HINTS_API_KEY || process.env.OPENAI_API_KEY || '';
const MODEL = process.env.AI_HINTS_MODEL || 'gpt-4o-mini';

async function generateHints(statement: string): Promise<string[]> {
  const body = {
    model: MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You write concise, ORIGINAL, progressive hints for a coding problem. Return ONLY a JSON array of 2-3 short strings, each nudging toward the solution without giving full code. No markdown, no preamble.',
      },
      { role: 'user', content: `Problem statement:\n\n${statement}\n\nReturn the JSON array of hints.` },
    ],
    temperature: 0.4,
  };
  const res = await fetch(`${BASE_URL.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = (data.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('model did not return a JSON array');
  return parsed.filter((x): x is string => typeof x === 'string').slice(0, 3);
}

async function main() {
  if (!BASE_URL || !API_KEY) {
    console.log('No LLM endpoint configured. Set AI_HINTS_BASE_URL + AI_HINTS_API_KEY (+ AI_HINTS_MODEL) to enable.');
    console.log('Example: AI_HINTS_BASE_URL=https://api.openai.com/v1 AI_HINTS_API_KEY=sk-... npx tsx scripts/dsa/gen-hints.ts --limit 20');
    await prisma.$disconnect();
    return;
  }

  const args = process.argv.slice(2);
  const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : 50;
  const statusIdx = args.indexOf('--status');
  const status = statusIdx >= 0 ? args[statusIdx + 1] : undefined;

  const problems = await prisma.dsaProblem.findMany({
    where: { hintsJson: null, ...(status ? { status } : {}) },
    select: { id: true, slug: true, statementMd: true },
    take: limit,
  });
  console.log(`Generating hints for ${problems.length} problems...`);

  let done = 0;
  for (const p of problems) {
    try {
      const hints = await generateHints(p.statementMd);
      if (hints.length) {
        await prisma.dsaProblem.update({ where: { id: p.id }, data: { hintsJson: JSON.stringify(hints) } });
        done += 1;
      }
    } catch (err) {
      console.warn(`  skip ${p.slug}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`Done. Added hints to ${done}/${problems.length} problems.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
