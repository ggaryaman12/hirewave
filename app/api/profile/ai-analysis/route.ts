import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateAiAnalysis } from '@/lib/dsa/ai-analysis';
import { checkRateLimit } from '@/lib/auth/rate-limit';

// Generates (and caches) a real AI analysis of the signed-in student's progress.
export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!checkRateLimit(`ai-analysis:${userId}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Please wait a moment before regenerating.' }, { status: 429 });
  }

  try {
    const analysis = await generateAiAnalysis(userId);
    return NextResponse.json(analysis);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Analysis failed' }, { status: 502 });
  }
}
