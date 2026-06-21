import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: { slug: string; id: string } }) {
  const row = await db.complexityAnalysisV2.findUnique({ where: { id: params.id } });
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ status: row.status, summary: row.summary ? JSON.parse(row.summary) : null });
}
