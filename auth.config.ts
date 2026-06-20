import type { NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';

// Edge-safe base config (imported by middleware). MUST NOT import Prisma,
// bcrypt, or any Node-only module — those live in auth.ts (Node runtime) which
// spreads this config and adds the adapter + Credentials provider.
export const authConfig = {
  pages: { signIn: '/login' },
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      // Lets an email/password user later link the same-email GitHub login.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? 'student';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? session.user.id;
        session.user.role = (token.role as string) ?? 'student';
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
