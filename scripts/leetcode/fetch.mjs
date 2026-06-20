// Fetches a LeetCode problem via the public GraphQL API.
//
// PERSONAL-STUDY TOOL. Pulls copyrighted statements against LeetCode ToS — keep
// it personal, do not redistribute or ship in a commercial product.
//
//   node scripts/leetcode/fetch.mjs two-sum            # print summary
//   node scripts/leetcode/fetch.mjs two-sum --raw out.json
const GQL = 'https://leetcode.com/graphql';

const QUERY = `query q($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId title titleSlug difficulty
    content metaData exampleTestcases sampleTestCase
    hints
    topicTags { slug }
    codeSnippets { langSlug code }
  }
}`;

export async function fetchLeetcode(titleSlug) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: `https://leetcode.com/problems/${titleSlug}/`,
      'User-Agent': 'Mozilla/5.0 (personal-study)',
    },
    body: JSON.stringify({ query: QUERY, variables: { titleSlug } }),
  });
  if (!res.ok) throw new Error(`LeetCode ${res.status}`);
  const json = await res.json();
  const q = json?.data?.question;
  if (!q) throw new Error(`no question for "${titleSlug}"`);
  return q;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: node scripts/leetcode/fetch.mjs <title-slug> [--raw out.json]');
    process.exit(1);
  }
  const q = await fetchLeetcode(slug);
  const rawIdx = process.argv.indexOf('--raw');
  if (rawIdx >= 0) {
    const { writeFileSync } = await import('fs');
    writeFileSync(process.argv[rawIdx + 1], JSON.stringify(q, null, 2));
    console.log('wrote', process.argv[rawIdx + 1]);
  }
  console.log(`${q.title} [${q.difficulty}]  tags=${q.topicTags.map((t) => t.slug).join(',')}`);
  console.log('langs:', q.codeSnippets.map((s) => s.langSlug).join(','));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
