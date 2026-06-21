import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { analyzeSubmissionComplexity } from '@/lib/dsa/complexity';

const schema = z.object({ submissionId: z.string().min(1).max(64) });

// Empirically measures the time/space complexity of a submission (no AI) by
// running it through the judge against generated inputs of increasing size.
export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  if (!checkRateLimit(`complexity:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const problem = await db.dsaProblem.findUnique({ where: { slug: params.slug }, select: { id: true } });
  if (!problem) return NextResponse.json({ error: 'Problem not found' }, { status: 404 });

  // The submission must belong to this problem (don't analyze arbitrary ids).
  const sub = await db.dsaSubmission.findUnique({ where: { id: body.submissionId }, select: { problemId: true } });
  if (!sub || sub.problemId !== problem.id) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  try {
    const result = await analyzeSubmissionComplexity(body.submissionId);
    if (!result) {
      return NextResponse.json({
        supported: false,
        reason: 'Complexity analysis needs a function-style problem with a sizeable (array/string) input.',
      });
    }
    return NextResponse.json({ supported: true, ...result });
  } catch {
    return NextResponse.json({ error: 'Complexity analysis failed' }, { status: 502 });
  }
}
