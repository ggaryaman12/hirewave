import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { getSessionByToken } from '@/lib/sessions';

export default async function SessionCompletePage({ params }: { params: { sessionToken: string } }) {
  const session = await getSessionByToken(params.sessionToken);

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5efe7] px-5 text-[#101010]">
        <section className="max-w-lg rounded-2xl border border-black/10 bg-white/75 p-8 text-center">
          <h1 className="text-3xl font-black">Session not found</h1>
          <p className="mt-3 text-sm leading-6 text-black/60">
            This assessment link is invalid or expired.
          </p>
        </section>
      </main>
    );
  }

  const submittedAt = session.submittedAt;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5efe7] px-5 text-[#101010]">
      <section className="max-w-xl rounded-2xl border border-black/10 bg-white/80 p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#d12864]">
          Assessment submitted
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
          Thank you, {session.candidate.name}
        </h1>
        <p className="mt-4 text-sm leading-6 text-black/65">
          Your work on {session.assessment.title} has been submitted. The hiring team can now review
          the code, timeline, AI transcript, commands, tests, and generated evaluation report.
        </p>
        <dl className="mt-6 grid gap-3 rounded-xl border border-black/10 bg-[#f7f0e7] p-4 text-left text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="font-bold text-black/50">Challenge</dt>
            <dd className="text-right font-black">{session.assessment.challenge.title}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="font-bold text-black/50">Status</dt>
            <dd className="text-right font-black capitalize">{session.status.replace('_', ' ')}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="font-bold text-black/50">Submitted</dt>
            <dd className="text-right font-black">
              {submittedAt ? new Intl.DateTimeFormat('en', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(submittedAt) : 'Just now'}
            </dd>
          </div>
        </dl>
        <Link
          href="/"
          className="mt-7 inline-flex rounded-md bg-[#111] px-5 py-3 text-sm font-bold text-paper hover:bg-black"
        >
          Back to Hirewave
        </Link>
      </section>
    </main>
  );
}
