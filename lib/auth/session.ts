import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export type SessionUser = { id: string; role: string; name?: string | null; email?: string | null; image?: string | null };

// Current authenticated user (or null). Safe to call in server components/routes.
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser | undefined) ?? null;
}

// Guards a server component / route. Redirects to /login if unauthenticated, and
// to '/' if a specific role is required and not held (admin always passes).
export async function requireUser(role?: 'student' | 'recruiter' | 'admin'): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (role && user.role !== role && user.role !== 'admin') redirect('/');
  return user;
}
