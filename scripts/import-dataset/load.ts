/* eslint-disable no-console */
// Loads a JSONL file of raw code_contests rows (produced by download.py) into
// the DSA problem bank as status:'review'. Idempotent (upsert by slug).
//
//   npx tsx scripts/import-dataset/load.ts <path-to.jsonl> [--limit N]
//
// Imported problems are stdin/stdout (no function signature). They land in a
// dedicated "Imported (CC BY)" track and are NOT published — a human flips
// status to 'published' after reviewing the statement + tests.
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { transformRow, type RawRow } from './transform';

const prisma = new PrismaClient();

async function ensureTopic(trackSlug: string, trackTitle: string, topicTitle: string) {
  const track =
    (await prisma.dsaTrack.findUnique({ where: { slug: trackSlug } })) ??
    (await prisma.dsaTrack.create({ data: { slug: trackSlug, title: trackTitle, source: 'deepmind/code_contests (CC BY 4.0)', sortOrder: 99 } }));
  const existing = await prisma.dsaTopic.findFirst({ where: { trackId: track.id, title: topicTitle } });
  return existing ?? prisma.dsaTopic.create({ data: { trackId: track.id, title: topicTitle, sortOrder: 0 } });
}

async function main() {
  const [file, ...rest] = process.argv.slice(2);
  if (!file) {
    console.error('usage: npx tsx scripts/import-dataset/load.ts <path-to.jsonl> [--limit N]');
    process.exit(1);
  }
  const limitIdx = rest.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(rest[limitIdx + 1]) : Infinity;

  const lines = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
  let imported = 0;
  let skipped = 0;

  for (const line of lines) {
    if (imported >= limit) break;
    let row: RawRow;
    try {
      row = JSON.parse(line) as RawRow;
    } catch {
      skipped += 1;
      continue;
    }

    const problem = transformRow(row);
    if (!problem) {
      skipped += 1;
      continue;
    }

    const topic = await ensureTopic('imported-ccby', 'Imported (CC BY)', problem.difficulty[0].toUpperCase() + problem.difficulty.slice(1));

    const data = {
      topicId: topic.id,
      title: problem.title,
      difficulty: problem.difficulty,
      statementMd: problem.statementMd,
      kind: 'stdin', // imported competitive problems are stdin/stdout
      comparison: problem.comparison,
      floatEpsilon: problem.floatEpsilon,
      attribution: problem.attribution,
      sourceUrl: problem.sourceUrl,
      categoryTagsJson: problem.categoryTags.length ? JSON.stringify(problem.categoryTags) : null,
      status: 'review', // human-review gate before publishing
    };

    const problemRow = await prisma.dsaProblem.upsert({
      where: { slug: problem.slug },
      update: data,
      create: { slug: problem.slug, ...data },
    });

    await prisma.dsaTestCase.deleteMany({ where: { problemId: problemRow.id } });
    for (let i = 0; i < problem.testCases.length; i += 1) {
      const tc = problem.testCases[i];
      await prisma.dsaTestCase.create({
        data: { problemId: problemRow.id, input: tc.input, expected: tc.expected, isSample: tc.isSample, sortOrder: i },
      });
    }
    imported += 1;
    if (imported % 25 === 0) console.log(`  imported ${imported}...`);
  }

  console.log(`Done. Imported ${imported}, skipped ${skipped}. All set to status='review'.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
