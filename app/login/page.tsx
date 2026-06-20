'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Github, Loader2 } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/profile';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setError('Invalid email or password.');
    else router.push(next);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#111] px-6 text-paper">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-black">Sign in</h1>
        <p className="mt-1 text-sm text-white/50">Practice DSA and track your progress.</p>

        <button
          type="button"
          onClick={() => signIn('github', { callbackUrl: next })}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-bold hover:bg-white/10"
        >
          <Github className="h-4 w-4" /> Continue with GitHub
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-white/30">
          <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={onSubmit} className="grid gap-3">
          <input
            type="email" required placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-white/10 bg-[#181818] px-3 py-2.5 text-sm outline-none focus:border-[#f15a29]/50"
          />
          <input
            type="password" required placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-white/10 bg-[#181818] px-3 py-2.5 text-sm outline-none focus:border-[#f15a29]/50"
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-md bg-[#f15a29] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
          </button>
        </form>

        <p className="mt-5 text-sm text-white/50">
          No account?{' '}
          <Link href="/signup" className="font-bold text-[#f15a29] hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
