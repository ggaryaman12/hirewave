import { NextRequest, NextResponse } from 'next/server';
import { requireHiringUser } from '@/lib/auth/demo-auth';
import { getReportExport } from '@/lib/evaluation/report-export';

const SUPPORTED_FORMATS = new Set(['json', 'markdown']);

export async function GET(request: NextRequest, { params }: { params: { sessionId: string } }) {
  const { workspace } = await requireHiringUser(`/dashboard/reports/${params.sessionId}`);
  const format = request.nextUrl.searchParams.get('format') || 'markdown';

  if (!SUPPORTED_FORMATS.has(format)) {
    return NextResponse.json({ error: 'Unsupported export format. Use json or markdown.' }, { status: 400 });
  }

  const exported = await getReportExport({
    sessionId: params.sessionId,
    workspaceId: workspace.id,
    format: format as 'json' | 'markdown',
  });

  if (!exported) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  return new NextResponse(exported.body, {
    headers: {
      'Content-Type': exported.contentType,
      'Content-Disposition': `attachment; filename="${exported.fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
