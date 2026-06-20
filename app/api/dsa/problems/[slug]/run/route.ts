import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runSamples } from '@/lib/judge/submit';

const schema = z.object({
  language: z.enum(['cpp', 'java', 'javascript']),
  source: z.string().min(1).max(200_000),
});

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request: language must be cpp/java/javascript and source non-empty.' }, { status: 400 });
  }

  try {
    const result = await runSamples({ slug: params.slug, language: body.language, source: body.source });
    if (!result) return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Run failed' }, { status: 500 });
  }
}
