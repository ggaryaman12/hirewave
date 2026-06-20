import { NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/auth';
import { demoRecruiterCredentials, ensureDemoRecruiter } from '@/lib/auth/demo-auth';
import { ensureChallengeCatalog } from '@/lib/challenge-catalog';

// DEV-ONLY convenience: establishes a real Auth.js session for the seeded demo
// recruiter and redirects. Disabled in production (use /login there).
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production. Use /login.' }, { status: 404 });
  }

  const requested = request.nextUrl.searchParams.get('next') || '/dashboard';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard';

  await ensureDemoRecruiter();
  await ensureChallengeCatalog();

  const { email, password } = demoRecruiterCredentials();
  // signIn issues the session cookie and returns a redirect Response.
  return signIn('credentials', { email, password, redirectTo: next });
}
