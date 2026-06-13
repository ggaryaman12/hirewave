import { NextRequest, NextResponse } from 'next/server';
import { DEMO_AUTH_COOKIE } from '@/lib/auth/demo-auth';
import { ensureChallengeCatalog } from '@/lib/challenge-catalog';
import { db } from '@/lib/db';
import { ensureDemoWorkspace } from '@/lib/demo-challenge';

export async function GET(request: NextRequest) {
  const requestedNext = request.nextUrl.searchParams.get('next') || '/dashboard';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//')
    ? requestedNext
    : '/dashboard';
  const email = process.env.DEMO_USER_EMAIL || 'founder@hirewave.local';

  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      name: 'Demo Founder',
      email,
    },
  });
  await ensureDemoWorkspace(user.id);
  await ensureChallengeCatalog();

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(DEMO_AUTH_COOKIE, email, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
