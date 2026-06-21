import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getDraft, saveDraft } from '@/lib/dsa/draft';

const LANGUAGES = ['cpp', 'java', 'javascript'] as const;

const saveSchema = z.object({
  language: z.enum(LANGUAGES),
  source: z.string().max(200_000),
});

async function resolveProblemId(slug: string): Promise<string | null> {
  const problem = await db.dsaProblem.findUnique({ where: { slug }, select: { id: true } });
  return problem?.id ?? null;
}

// Load the saved draft for the current user + language. Anonymous users persist
// only to localStorage, so we return null (not an error) for them.
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ draft: null });

  const language = request.nextUrl.searchParams.get('language');
  if (!language || !LANGUAGES.includes(language as (typeof LANGUAGES)[number])) {
    return NextResponse.json({ error: 'Invalid or missing language' }, { status: 400 });
  }

  const problemId = await resolveProblemId(params.slug);
  if (!problemId) return NextResponse.json({ error: 'Problem not found' }, { status: 404 });

  const draft = await getDraft({ userId: session.user.id, problemId, language });
  return NextResponse.json({
    draft: draft ? { source: draft.source, updatedAt: draft.updatedAt.toISOString() } : null,
  });
}

// Upsert the draft (last-write-wins). PUT = debounced periodic sync;
// POST = the same, used by navigator.sendBeacon on page-hide (beacon is
// POST-only). Both share one handler.
async function persist(request: NextRequest, slug: string) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  let body: z.infer<typeof saveSchema>;
  try {
    body = saveSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const problemId = await resolveProblemId(slug);
  if (!problemId) return NextResponse.json({ error: 'Problem not found' }, { status: 404 });

  await saveDraft({ userId: session.user.id, problemId, language: body.language, source: body.source });
  return NextResponse.json({ ok: true });
}

export async function PUT(request: NextRequest, { params }: { params: { slug: string } }) {
  return persist(request, params.slug);
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  return persist(request, params.slug);
}
