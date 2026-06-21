import { db } from '@/lib/db';

// Durable, cross-device autosave for in-progress DSA solutions. localStorage is
// the instant per-keystroke reload-recovery layer on the client; this is the
// debounced, last-write-wins server layer. One row per (user, problem, language).

const MAX_SOURCE = 200_000;

type DraftKey = { userId: string; problemId: string; language: string };

function whereKey(key: DraftKey) {
  return {
    userId_problemId_language: {
      userId: key.userId,
      problemId: key.problemId,
      language: key.language,
    },
  };
}

export async function getDraft(key: DraftKey) {
  return db.dsaDraft.findUnique({ where: whereKey(key) });
}

export async function saveDraft(input: DraftKey & { source: string }) {
  const source = input.source.slice(0, MAX_SOURCE);
  return db.dsaDraft.upsert({
    where: whereKey(input),
    create: { userId: input.userId, problemId: input.problemId, language: input.language, source },
    update: { source },
  });
}
