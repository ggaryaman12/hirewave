import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { registerUser } from '@/lib/auth/register';
import { UserRole } from '@/lib/constants';

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  role: z.enum([UserRole.STUDENT, UserRole.RECRUITER]).default(UserRole.STUDENT),
  company: z.string().trim().max(80).optional(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  if (!checkRateLimit(`signup:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Name, a valid email, and an 8+ char password are required.' }, { status: 400 });
  }

  const email = body.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  const user = await registerUser({
    name: body.name,
    email,
    password: body.password,
    role: body.role,
    company: body.company,
  });

  return NextResponse.json({ ok: true, role: user.role }, { status: 201 });
}
