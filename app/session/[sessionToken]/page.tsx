import { AssessmentRoom } from '@/components/candidate/assessment-room';
import { getSessionByToken, serializeSession } from '@/lib/sessions';

export default async function CandidateSessionPage({ params }: { params: { sessionToken: string } }) {
  const session = await getSessionByToken(params.sessionToken);

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#111] px-6 text-paper">
        <div className="max-w-md rounded-xl border border-white/10 bg-white/10 p-8 text-center">
          <h1 className="text-2xl font-black">Session not found</h1>
          <p className="mt-2 text-sm text-white/55">This session link is invalid or has expired.</p>
        </div>
      </main>
    );
  }

  return <AssessmentRoom sessionToken={params.sessionToken} initialSession={serializeSession(session)} />;
}
