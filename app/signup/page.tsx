'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Github, Loader2 } from 'lucide-react';

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/profile';
  const [role, setRole] = useState<'student' | 'recruiter'>('student');
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, company: role === 'recruiter' ? company : undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Could not create account.');
        setLoading(false);
        return;
      }
      const signed = await signIn('credentials', { email, password, redirect: false });
      setLoading(false);
      const destination = role === 'recruiter' ? '/dashboard' : next;
      if (signed?.error) router.push('/login');
      else router.push(destination);
    } catch {
      setError('Network error. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#111] px-6 text-paper">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-black">Create your account</h1>
        <p className="mt-1 text-sm text-white/50">
          {role === 'recruiter'
            ? 'Set up a workspace and start assessing candidates.'
            : 'Start practicing and climb the leaderboard.'}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-md border border-white/10 bg-[#181818] p-1">
          {(['student', 'recruiter'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded px-3 py-1.5 text-xs font-black capitalize transition ${
                role === r ? 'bg-[#f15a29] text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              {r === 'student' ? 'I practice (Student)' : 'I hire (Recruiter)'}
            </button>
          ))}
        </div>

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
          {role === 'recruiter' && (
            <input
              placeholder="Company (optional)" value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="rounded-md border border-white/10 bg-[#181818] px-3 py-2.5 text-sm outline-none focus:border-[#f15a29]/50"
            />
          )}
          <input
            required placeholder="Name" value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-white/10 bg-[#181818] px-3 py-2.5 text-sm outline-none focus:border-[#f15a29]/50"
          />
          <input
            type="email" required placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-white/10 bg-[#181818] px-3 py-2.5 text-sm outline-none focus:border-[#f15a29]/50"
          />
          <input
            type="password" required minLength={8} placeholder="Password (8+ characters)" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-white/10 bg-[#181818] px-3 py-2.5 text-sm outline-none focus:border-[#f15a29]/50"
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-md bg-[#f15a29] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create account
          </button>
        </form>

        <p className="mt-5 text-sm text-white/50">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-[#f15a29] hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
