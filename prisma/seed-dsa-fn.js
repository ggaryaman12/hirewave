// Seeds the function-mode (LeetCode-style) problem bank from the generated
// suites in scripts/dsa/generated/. Run `node scripts/dsa/generate.mjs` first.
//
// CommonJS to match prisma/seed.js. Exposes seedDsaFn(prisma); idempotent:
// tracks/topics are find-or-created, problems upserted by slug, test cases
// replaced on every run.
const fs = require('fs');
const path = require('path');

const GEN_DIR = path.join(__dirname, '..', 'scripts', 'dsa', 'generated');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(GEN_DIR, file), 'utf8'));
}

async function findOrCreateTrack(prisma, track) {
  const existing = await prisma.dsaTrack.findUnique({ where: { slug: track.slug } });
  if (existing) {
    return prisma.dsaTrack.update({
      where: { id: existing.id },
      data: { title: track.title, source: track.source ?? null, sortOrder: track.sortOrder ?? 0 },
    });
  }
  return prisma.dsaTrack.create({
    data: { slug: track.slug, title: track.title, source: track.source ?? null, sortOrder: track.sortOrder ?? 0 },
  });
}

async function findOrCreateTopic(prisma, trackId, topic) {
  const existing = await prisma.dsaTopic.findFirst({ where: { trackId, title: topic.title } });
  if (existing) {
    return prisma.dsaTopic.update({ where: { id: existing.id }, data: { sortOrder: topic.sortOrder ?? 0 } });
  }
  return prisma.dsaTopic.create({ data: { trackId, title: topic.title, sortOrder: topic.sortOrder ?? 0 } });
}

async function seedDsaFn(prisma) {
  if (!fs.existsSync(GEN_DIR) || !fs.existsSync(path.join(GEN_DIR, 'tracks.json'))) {
    console.warn('seedDsaFn: no generated suites found; run `node scripts/dsa/generate.mjs` first. Skipping.');
    return;
  }

  const tracks = readJson('tracks.json');
  const index = readJson('index.json');

  // trackSlug -> topicKey -> topicId
  const topicIndex = {};
  for (const track of tracks) {
    const trackRow = await findOrCreateTrack(prisma, track);
    topicIndex[track.slug] = {};
    for (const topic of track.topics) {
      const topicRow = await findOrCreateTopic(prisma, trackRow.id, topic);
      topicIndex[track.slug][topic.key] = topicRow.id;
    }
  }

  for (const { slug } of index) {
    const p = readJson(`${slug}.json`);
    const topicId = topicIndex[p.track] && topicIndex[p.track][p.topic];
    if (!topicId) throw new Error(`seedDsaFn: no topic for ${p.track}/${p.topic} (problem ${p.slug})`);

    const data = {
      topicId,
      title: p.title,
      difficulty: p.difficulty,
      statementMd: p.statementMd,
      constraintsMd: p.constraintsMd,
      inputFormat: p.inputFormat,
      outputFormat: p.outputFormat,
      kind: p.kind || 'function',
      functionName: p.functionName,
      signatureJson: p.signatureJson,
      designSpecJson: p.designSpecJson || null,
      comparison: p.comparison,
      floatEpsilon: p.floatEpsilon,
      timeLimitMs: p.timeLimitMs,
      memoryLimitMb: p.memoryLimitMb,
      categoryTagsJson: p.categoryTags && p.categoryTags.length ? JSON.stringify(p.categoryTags) : null,
      companyTagsJson: p.companyTags && p.companyTags.length ? JSON.stringify(p.companyTags) : null,
      hintsJson: p.hints && p.hints.length ? JSON.stringify(p.hints) : null,
      sourceUrl: null,
      attribution: 'Original problem authored for the Hirewave DSA bank.',
      status: 'published',
    };

    const problemRow = await prisma.dsaProblem.upsert({
      where: { slug: p.slug },
      update: data,
      create: { slug: p.slug, ...data },
    });

    await prisma.dsaTestCase.deleteMany({ where: { problemId: problemRow.id } });
    for (const t of p.testCases) {
      await prisma.dsaTestCase.create({
        data: {
          problemId: problemRow.id,
          input: t.input,
          expected: t.expected,
          isSample: t.isSample,
          sortOrder: t.sortOrder,
        },
      });
    }
  }

  console.log(`seedDsaFn: seeded ${index.length} function-mode problems`);
}

module.exports = { seedDsaFn };
