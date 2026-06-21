import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { createWorkspaceForOwner } from '@/lib/workspace';

export type RegisterRole = 'student' | 'recruiter';

// Creates an account. A recruiter additionally gets their own workspace (with an
// owner membership) so they land in a usable dashboard immediately — the missing
// piece of the hiring onboarding happy path.
export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  role: RegisterRole;
  company?: string;
}) {
  const email = input.email.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await db.user.create({
    data: { name: input.name, email, passwordHash, role: input.role },
  });

  if (input.role === 'recruiter') {
    const workspaceName = (input.company?.trim() || `${input.name}'s Workspace`).slice(0, 80);
    await createWorkspaceForOwner({ userId: user.id, name: workspaceName });
  }

  return user;
}
