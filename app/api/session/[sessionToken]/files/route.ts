import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionByToken, saveSessionFile } from '@/lib/sessions';
import { validateWorkspacePath } from '@/lib/workspace-paths';

const saveFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  language: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { sessionToken: string } }) {
  const session = await getSessionByToken(params.sessionToken);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (['submitted', 'expired', 'report_ready'].includes(session.status)) {
    return NextResponse.json({ error: 'Session is closed' }, { status: 409 });
  }

  const body = saveFileSchema.parse(await request.json());
  const workspacePath = validateWorkspacePath(body.path);
  if (!workspacePath.ok) {
    return NextResponse.json(
      {
        error: `Unsafe workspace file path: ${workspacePath.reason}`,
      },
      { status: 400 },
    );
  }

  const snapshot = await saveSessionFile({
    sessionId: session.id,
    path: workspacePath.path,
    content: body.content,
    language: body.language,
  });

  return NextResponse.json({
    snapshot: {
      id: snapshot.id,
      path: snapshot.path,
      version: snapshot.version,
      createdAt: snapshot.createdAt.toISOString(),
    },
  });
}
