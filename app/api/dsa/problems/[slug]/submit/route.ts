import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { submitSolution } from '@/lib/judge/submit';

const schema = z.object({
  language: z.string().min(1).max(40),
  source: z.string().min(1).max(200_000),
  sessionId: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const body = schema.parse(await request.json());
  const result = await submitSolution({
    slug: params.slug,
    language: body.language,
    source: body.source,
    sessionId: body.sessionId,
  });

  if (!result) return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
  return NextResponse.json(result);
}
