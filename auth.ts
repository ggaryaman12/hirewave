import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authConfig } from '@/auth.config';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

// Full Node-runtime auth (route handlers + server helpers). JWT session strategy
// is required for the Credentials provider; the Prisma adapter still persists
// GitHub OAuth users/accounts.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const parsed = credentialsSchema.safeParse(creds);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role, image: user.image };
      },
    }),
  ],
});
