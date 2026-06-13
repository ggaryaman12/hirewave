import { Clock, ShieldCheck, Sparkles } from 'lucide-react';
import { startCandidateSessionAction } from '@/lib/actions/candidate';
import { db } from '@/lib/db';
import { parseJson } from '@/lib/json';
import { tokenHash } from '@/lib/tokens';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_details: 'Enter a valid name and email address before starting.',
  invite_unavailable: 'This assessment link is invalid or no longer active.',
  invite_expired: 'This assessment link has expired.',
  invite_full: 'This assessment link has reached its usage limit.',
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { error?: string };
}) {
  const invite = await db.inviteLink.findUnique({
    where: { tokenHash: tokenHash(params.token) },
    include: {
      assessment: {
        include: {
          challenge: true,
        },
      },
    },
  });

  if (!invite || invite.status !== 'active') {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5efe7] px-6 text-[#101010]">
        <div className="max-w-md rounded-xl border border-black/10 bg-white/70 p-8 text-center">
          <h1 className="text-2xl font-black">Invite unavailable</h1>
          <p className="mt-2 text-sm text-black/60">This assessment link is invalid, expired, or no longer active.</p>
        </div>
      </main>
    );
  }

  const assessment = invite.assessment;
  const errorMessage = searchParams?.error ? ERROR_MESSAGES[searchParams.error] : null;

  return (
    <main className="min-h-screen bg-[#f5efe7] px-5 py-8 text-[#101010]">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_420px]">
        <section className="rounded-2xl border border-black/10 bg-white/65 p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d12864]">Hirewave assessment invite</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight md:text-6xl">{assessment.title}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-black/65">{assessment.challenge.scenario}</p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <Info icon={Clock} label="Duration" value={`${assessment.durationMinutes} minutes`} />
            <Info icon={Sparkles} label="AI policy" value={`AI ${assessment.aiMode}`} />
            <Info icon={ShieldCheck} label="Account" value="No candidate account" />
          </div>

          <div className="mt-8 rounded-xl border border-black/10 bg-[#111] p-6 text-paper">
            <h2 className="text-xl font-black">{assessment.challenge.title}</h2>
            <p className="mt-3 text-sm leading-6 text-paper/70">{assessment.challenge.instructions}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {parseJson<string[]>(assessment.challenge.stackJson, []).map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border border-black/10 bg-white/75 p-6">
          <h2 className="text-2xl font-black">Start session</h2>
          <p className="mt-2 text-sm leading-6 text-black/60">
            Your prompts, AI responses, file edits, commands, tests, timing, and final code are recorded for evaluator review.
          </p>

          {errorMessage ? (
            <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <form action={startCandidateSessionAction} className="mt-6 grid gap-4">
            <input type="hidden" name="inviteToken" value={params.token} />
            <label className="grid gap-2">
              <span className="text-sm font-bold">Full name</span>
              <input
                name="name"
                className="h-11 rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#d12864]"
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold">Email</span>
              <input
                name="email"
                type="email"
                className="h-11 rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#d12864]"
                required
              />
            </label>
            <button type="submit" className="mt-2 rounded-md bg-[#111] px-5 py-3 text-sm font-bold text-paper hover:bg-black">
              Start assessment
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-[#f7f0e7] p-4">
      <Icon className="h-5 w-5 text-[#d12864]" />
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-black/45">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}
