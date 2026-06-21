import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { parseSignature, wrapSource } from '@/lib/judge/harness';
import { analyzeComplexity } from '@/lib/complexity/analyze';
import { codeHashOf, getAnalysis, saveAnalysis } from '@/lib/complexity/store';

const schema = z.object({ language: z.string().min(1), source: z.string().min(1).max(200_000) });

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  if (!checkRateLimit(`complexity-v2:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 });
  }
  let body: z.infer<typeof schema>;
  try { body = schema.parse(await req.json()); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const lang = body.language.toLowerCase();
  if (lang !== 'javascript' && lang !== 'js' && lang !== 'node') {
    return NextResponse.json({ status: 'unsupported_language', message: 'The v2 analyzer supports JavaScript only.' });
  }

  const problem = await db.dsaProblem.findUnique({ where: { slug: params.slug }, select: { id: true, signatureJson: true } });
  if (!problem) return NextResponse.json({ error: 'Problem not found' }, { status: 404 });

  const codeHash = codeHashOf('javascript', problem.id, body.source);
  const cached = await getAnalysis(codeHash);
  if (cached?.status === 'done') return NextResponse.json({ analysisId: cached.id, status: 'done', summary: cached.summary });

  // Wrap function-mode source so it actually reads stdin + runs (user code stays at top → lines aligned).
  let runnable = body.source;
  const sig = parseSignature(problem.signatureJson);
  if (sig) { try { runnable = wrapSource('javascript', sig, body.source); } catch { runnable = body.source; } }

  const cases = await db.dsaTestCase.findMany({ where: { problemId: problem.id }, select: { input: true } });
  const mapped = cases.map((c) => ({ stdin: c.input ?? '' })).filter((c) => c.stdin.length > 0);

  const result = analyzeComplexity({ code: body.source, runnable, lang: 'javascript', cases: mapped });
  const saved = await saveAnalysis({
    codeHash, problemId: problem.id, lang: 'javascript', status: result.status,
    summary: result.summary, steps: result.steps,
  });
  return NextResponse.json({ analysisId: saved.id, status: result.status, summary: result.summary });
}
