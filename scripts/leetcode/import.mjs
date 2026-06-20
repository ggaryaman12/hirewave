// Imports LeetCode problems as function-mode practice problems.
//
// PERSONAL-STUDY TOOL. Fetches copyrighted LeetCode statements via their GraphQL
// API (against ToS). Keep personal; do NOT redistribute or ship in a commercial
// product. Imported problems are tagged personal-use and land as status=review.
//
//   node scripts/leetcode/import.mjs two-sum valid-anagram coin-change
//   node scripts/leetcode/import.mjs --file scripts/leetcode/slugs.txt --status review
//
// Limitation: LeetCode does not expose hidden tests, so only the visible SAMPLE
// cases are imported (great for practice + "Run samples"; "Submit" grades vs
// samples only). Problems using ListNode/TreeNode/etc. are skipped.
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { fetchLeetcode } from './fetch.mjs';
import { metaToSignature } from './lc-map.mjs';
import { buildSamples } from './lc-samples.mjs';

const prisma = new PrismaClient();

function htmlToMarkdown(html) {
  return html
    .replace(/<pre>/gi, '\n```\n').replace(/<\/pre>/gi, '\n```\n')
    .replace(/<code>/gi, '`').replace(/<\/code>/gi, '`')
    .replace(/<\/(strong|b)>/gi, '**').replace(/<(strong|b)>/gi, '**')
    .replace(/<\/(em|i)>/gi, '*').replace(/<(em|i)>/gi, '*')
    .replace(/<li>/gi, '\n- ').replace(/<\/li>/gi, '')
    .replace(/<sup>/gi, '^').replace(/<\/sup>/gi, '')
    .replace(/<sub>/gi, '_').replace(/<\/sub>/gi, '')
    .replace(/<\/p>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function ensureTopic(difficulty) {
  const trackSlug = 'leetcode-personal';
  const track =
    (await prisma.dsaTrack.findUnique({ where: { slug: trackSlug } })) ??
    (await prisma.dsaTrack.create({ data: { slug: trackSlug, title: 'LeetCode (personal study)', source: 'leetcode.com', sortOrder: 50 } }));
  const title = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
  const existing = await prisma.dsaTopic.findFirst({ where: { trackId: track.id, title } });
  return existing ?? prisma.dsaTopic.create({ data: { trackId: track.id, title, sortOrder: 0 } });
}

async function importOne(slug, status) {
  const q = await fetchLeetcode(slug);
  const mapped = metaToSignature(q.metaData);
  if (!mapped.signature) return { slug, skipped: mapped.unsupported ? `unsupported types: ${mapped.unsupported.join(',')}` : mapped.error };

  const built = buildSamples(mapped.signature, q.exampleTestcases, q.content);
  if (!built.samples) return { slug, skipped: built.error };

  const topic = await ensureTopic(q.difficulty);
  const hints = Array.isArray(q.hints) ? q.hints.map((h) => htmlToMarkdown(h)).filter(Boolean) : [];
  const categoryTags = (q.topicTags || []).map((t) => t.slug);

  const data = {
    topicId: topic.id,
    title: q.title,
    difficulty: q.difficulty.toLowerCase(),
    statementMd: htmlToMarkdown(q.content),
    kind: 'function',
    functionName: mapped.signature.functionName,
    signatureJson: JSON.stringify(mapped.signature),
    designSpecJson: null,
    comparison: 'whitespace',
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    categoryTagsJson: categoryTags.length ? JSON.stringify(categoryTags) : null,
    hintsJson: hints.length ? JSON.stringify(hints.slice(0, 4)) : null,
    sourceUrl: `https://leetcode.com/problems/${slug}/`,
    attribution: 'Imported from LeetCode for PERSONAL STUDY (statement © LeetCode). Sample cases only.',
    status,
  };

  const row = await prisma.dsaProblem.upsert({ where: { slug }, update: data, create: { slug, ...data } });
  await prisma.dsaTestCase.deleteMany({ where: { problemId: row.id } });
  for (const t of built.samples) {
    await prisma.dsaTestCase.create({ data: { problemId: row.id, input: t.input, expected: t.expected, isSample: true, sortOrder: t.sortOrder } });
  }
  return { slug, imported: built.samples.length };
}

async function main() {
  const args = process.argv.slice(2);
  const statusIdx = args.indexOf('--status');
  const status = statusIdx >= 0 ? args[statusIdx + 1] : 'review';
  const fileIdx = args.indexOf('--file');
  let slugs = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--status' && args[i - 1] !== '--file');
  if (fileIdx >= 0) {
    slugs = readFileSync(args[fileIdx + 1], 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  }
  if (!slugs.length) {
    console.error('usage: node scripts/leetcode/import.mjs <slug...> | --file slugs.txt [--status review]');
    process.exit(1);
  }

  let imported = 0;
  let skipped = 0;
  for (const slug of slugs) {
    try {
      const r = await importOne(slug, status);
      if (r.imported) { imported += 1; console.log(`  ✓ ${slug} (${r.imported} samples)`); }
      else { skipped += 1; console.log(`  - skip ${slug}: ${r.skipped}`); }
    } catch (err) {
      skipped += 1;
      console.log(`  ! ${slug}: ${err instanceof Error ? err.message : err}`);
    }
    await new Promise((res) => setTimeout(res, 400));
  }
  console.log(`\nDone. Imported ${imported}, skipped ${skipped}. status=${status}`);
  await prisma.$disconnect();
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
