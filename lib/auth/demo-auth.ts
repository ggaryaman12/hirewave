import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

export const DEMO_AUTH_COOKIE = 'hirewave_demo_user';

export async function getDemoUser() {
  const email = cookies().get(DEMO_AUTH_COOKIE)?.value;
  if (!email) return null;

  return db.user.findUnique({
    where: { email },
    include: {
      memberships: {
        include: { workspace: true },
        take: 1,
      },
    },
  });
}

export async function requireHiringUser(next = '/dashboard') {
  const user = await getDemoUser();
  const encodedNext = encodeURIComponent(next);
  if (!user) redirect(`/api/auth/demo?next=${encodedNext}`);

  const membership = user.memberships[0];
  if (!membership) redirect(`/api/auth/demo?next=${encodedNext}`);

  return {
    user,
    workspace: membership.workspace,
    role: membership.role,
  };
}
