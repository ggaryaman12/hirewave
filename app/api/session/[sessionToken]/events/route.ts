import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionByToken } from '@/lib/sessions';
import { logSessionEvent } from '@/lib/telemetry';

const eventSchema = z.object({
  type: z.enum(['file_opened', 'candidate_note_added', 'focus_changed', 'error_occurred']),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest, { params }: { params: { sessionToken: string } }) {
  const session = await getSessionByToken(params.sessionToken);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const body = eventSchema.parse(await request.json());
  const event = await logSessionEvent({
    sessionId: session.id,
    type: body.type,
    actor: body.type === 'error_occurred' ? 'system' : 'candidate',
    payload: body.payload || {},
  });

  return NextResponse.json({ eventId: event.id });
}
