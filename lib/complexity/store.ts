import { createHash } from 'crypto';
import { db } from '@/lib/db';
import type { ComplexitySummary, SimStep } from '@/lib/complexity/types';

export function codeHashOf(lang: string, problemId: string, code: string): string {
  return createHash('sha256').update(`${lang}\n${problemId}\n${code}`).digest('hex');
}

export async function getAnalysis(codeHash: string) {
  const row = await db.complexityAnalysisV2.findUnique({ where: { codeHash } });
  if (!row) return null;
  return { id: row.id, status: row.status, summary: row.summary ? (JSON.parse(row.summary) as ComplexitySummary) : null };
}

export async function saveAnalysis(input: {
  codeHash: string; problemId: string; lang: string; status: string;
  summary: ComplexitySummary | null; steps: SimStep[];
}): Promise<{ id: string }> {
  const row = await db.complexityAnalysisV2.upsert({
    where: { codeHash: input.codeHash },
    create: {
      codeHash: input.codeHash, problemId: input.problemId, lang: input.lang, status: input.status,
      bigOTime: input.summary?.bigOTime, bigOSpace: input.summary?.bigOSpace, confidence: input.summary?.confidence,
      summary: input.summary ? JSON.stringify(input.summary) : null,
    },
    update: {
      status: input.status, bigOTime: input.summary?.bigOTime, bigOSpace: input.summary?.bigOSpace,
      confidence: input.summary?.confidence, summary: input.summary ? JSON.stringify(input.summary) : null,
    },
  });
  await db.simulationStepV2.deleteMany({ where: { analysisId: row.id } });
  if (input.steps.length) {
    await db.simulationStepV2.createMany({
      data: input.steps.slice(0, 5000).map((s) => ({
        analysisId: row.id, idx: s.idx, lineNumber: s.lineNumber, recursDepth: s.recursionDepth,
        callStack: JSON.stringify(s.callStack ?? []), variables: JSON.stringify(s.variables ?? {}), note: s.note,
      })),
    });
  }
  return { id: row.id };
}

export async function getSteps(analysisId: string, cursor: number, limit: number) {
  const rows = await db.simulationStepV2.findMany({
    where: { analysisId, idx: { gte: cursor } }, orderBy: { idx: 'asc' }, take: limit,
  });
  const steps: SimStep[] = rows.map((r) => ({
    idx: r.idx, lineNumber: r.lineNumber, recursionDepth: r.recursDepth,
    callStack: JSON.parse(r.callStack) as string[], variables: JSON.parse(r.variables) as Record<string, string>,
    note: r.note ?? undefined,
  }));
  const nextCursor = rows.length === limit ? cursor + limit : null;
  return { steps, nextCursor };
}
