import { expect, test } from '@playwright/test';
import crypto from 'crypto';
import { db } from '../../lib/db';
import { getDraft, saveDraft } from '../../lib/dsa/draft';

async function makeUser() {
  return db.user.create({
    data: { name: 'D', email: `draft-${crypto.randomBytes(5).toString('hex')}@test.local`, role: 'student' },
  });
}

async function makeProblem() {
  const slug = `draft-${crypto.randomBytes(4).toString('hex')}`;
  return db.dsaProblem.create({
    data: { slug, title: 'Echo', difficulty: 'easy', statementMd: 'echo', status: 'published' },
  });
}

test.describe('DSA draft autosave', () => {
  test('saveDraft then getDraft returns the source', async () => {
    const user = await makeUser();
    const problem = await makeProblem();
    await saveDraft({ userId: user.id, problemId: problem.id, language: 'cpp', source: 'int main(){}' });

    const draft = await getDraft({ userId: user.id, problemId: problem.id, language: 'cpp' });
    expect(draft?.source).toBe('int main(){}');
  });

  test('re-saving the same key updates in place (one row, last-write-wins)', async () => {
    const user = await makeUser();
    const problem = await makeProblem();
    await saveDraft({ userId: user.id, problemId: problem.id, language: 'cpp', source: 'v1' });
    await saveDraft({ userId: user.id, problemId: problem.id, language: 'cpp', source: 'v2' });

    const rows = await db.dsaDraft.count({
      where: { userId: user.id, problemId: problem.id, language: 'cpp' },
    });
    expect(rows).toBe(1);

    const draft = await getDraft({ userId: user.id, problemId: problem.id, language: 'cpp' });
    expect(draft?.source).toBe('v2');
  });

  test('drafts are isolated per language', async () => {
    const user = await makeUser();
    const problem = await makeProblem();
    await saveDraft({ userId: user.id, problemId: problem.id, language: 'cpp', source: 'cpp-src' });
    await saveDraft({ userId: user.id, problemId: problem.id, language: 'java', source: 'java-src' });

    expect((await getDraft({ userId: user.id, problemId: problem.id, language: 'cpp' }))?.source).toBe('cpp-src');
    expect((await getDraft({ userId: user.id, problemId: problem.id, language: 'java' }))?.source).toBe('java-src');
  });

  test('source is capped to protect the row', async () => {
    const user = await makeUser();
    const problem = await makeProblem();
    await saveDraft({ userId: user.id, problemId: problem.id, language: 'cpp', source: 'x'.repeat(250_000) });

    const draft = await getDraft({ userId: user.id, problemId: problem.id, language: 'cpp' });
    expect(draft?.source.length).toBe(200_000);
  });
});
