import { NextResponse } from 'next/server';
import { getSteps } from '@/lib/complexity/store';

export async function GET(req: Request, { params }: { params: { slug: string; id: string } }) {
  const url = new URL(req.url);
  const cursor = Number(url.searchParams.get('cursor') ?? '0') || 0;
  const limit = Math.min(500, Number(url.searchParams.get('limit') ?? '200') || 200);
  const { steps, nextCursor } = await getSteps(params.id, cursor, limit);
  return NextResponse.json({ steps, nextCursor, truncated: steps.length >= 5000 });
}
