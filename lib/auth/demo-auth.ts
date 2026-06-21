import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { ensureDemoWorkspace } from '@/lib/demo-challenge';
import { UserRole } from '@/lib/constants';

const DEMO_EMAIL = (process.env.DEMO_RECRUITER_EMAIL || 'founder@hirewave.local').toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_RECRUITER_PASSWORD || 'demo-password-123';

export function demoRecruiterCredentials() {
  return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
}

// Ensures the seeded demo recruiter (real account: email+password, role
// recruiter, workspace) exists. Idempotent.
export async function ensureDemoRecruiter() {
  let user = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    user = await db.user.create({ data: { name: 'Demo Founder', email: DEMO_EMAIL, passwordHash, role: UserRole.RECRUITER } });
  } else if (!user.passwordHash || user.role !== UserRole.RECRUITER) {
    const passwordHash = user.passwordHash ?? (await bcrypt.hash(DEMO_PASSWORD, 10));
    user = await db.user.update({ where: { id: user.id }, data: { passwordHash, role: UserRole.RECRUITER } });
  }
  await ensureDemoWorkspace(user.id);
  return user;
}

// Company-vertical guard. Uses the real Auth.js session; same return shape as
// before so callers don't change. (Students are bounced by middleware before
// reaching dashboard pages.)
export async function requireHiringUser(next = '/dashboard') {
  const encodedNext = encodeURIComponent(next);
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?next=${encodedNext}`);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { memberships: { include: { workspace: true }, take: 1 } },
  });
  const membership = user?.memberships[0];
  if (!user || !membership) redirect(`/login?next=${encodedNext}`);

  return { user, workspace: membership.workspace, role: membership.role };
}
