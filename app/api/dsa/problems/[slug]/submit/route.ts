import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { submitSolution } from '@/lib/judge/submit';
import { LANGUAGES } from '@/lib/constants';

const schema = z.object({
  language: z.enum(LANGUAGES),
  source: z.string().min(1).max(200_000),
  sessionId: z.string().optional(),
  // Client-generated UUID per Submit click; a network retry of the same click
  // reuses it so the attempt judges exactly once. Optional for back-compat.
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request: language must be cpp/java/javascript and source non-empty.' }, { status: 400 });
  }

  const session = await auth();

  try {
    const result = await submitSolution({
      slug: params.slug,
      language: body.language,
      source: body.source,
      sessionId: body.sessionId,
      idempotencyKey: body.idempotencyKey,
      userId: session?.user?.id,
    });
    if (!result) return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Submit failed' }, { status: 500 });
  }
}
