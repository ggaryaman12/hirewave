import crypto from 'crypto';
import { db } from '@/lib/db';

// Workspace creation for the hiring vertical. A recruiter owns a workspace; all
// tenant-scoped data (assessments, candidates, reports) hangs off it. The slug
// gets a short random suffix so two companies with the same name never collide
// (avoids a check-and-retry round trip).

export function slugifyWorkspaceName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'workspace'
  );
}

export async function createWorkspaceForOwner(input: { userId: string; name: string }) {
  const slug = `${slugifyWorkspaceName(input.name)}-${crypto.randomBytes(3).toString('hex')}`;
  const workspace = await db.workspace.create({ data: { name: input.name, slug } });
  await db.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: input.userId, role: 'owner' },
  });
  return workspace;
}
