import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { UserRole } from '@/lib/constants';
import { createWorkspaceForOwner } from '@/lib/workspace';

// Self-serve signup creates a student or a recruiter (admins are provisioned
// elsewhere), so the role here is a subset of UserRole.
export type RegisterRole = typeof UserRole.STUDENT | typeof UserRole.RECRUITER;

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

  if (input.role === UserRole.RECRUITER) {
    const workspaceName = (input.company?.trim() || `${input.name}'s Workspace`).slice(0, 80);
    await createWorkspaceForOwner({ userId: user.id, name: workspaceName });
  }

  return user;
}
