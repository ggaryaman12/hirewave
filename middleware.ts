import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

// Edge middleware uses ONLY the edge-safe config (no Prisma/bcrypt). It reads the
// JWT to gate protected areas and keep the two verticals separate.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const user = req.auth?.user as { role?: string } | undefined;
  const isAuthed = Boolean(user);
  const path = nextUrl.pathname;
  const onDashboard = path.startsWith('/dashboard');
  const onProfile = path.startsWith('/profile');

  if ((onDashboard || onProfile) && !isAuthed) {
    const url = new URL('/login', nextUrl);
    url.searchParams.set('next', path);
    return Response.redirect(url);
  }

  // Students don't have a company dashboard — send them to their profile.
  if (onDashboard && isAuthed && user?.role === 'student') {
    return Response.redirect(new URL('/profile', nextUrl));
  }

  return undefined;
});

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*'],
};
