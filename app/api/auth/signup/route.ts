import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/auth/rate-limit';

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
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

  const passwordHash = await bcrypt.hash(body.password, 10);
  await db.user.create({ data: { name: body.name, email, passwordHash, role: 'student' } });

  return NextResponse.json({ ok: true }, { status: 201 });
}
