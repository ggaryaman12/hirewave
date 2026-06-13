import Link from 'next/link';
import { FileCode2, Sparkles } from 'lucide-react';
import { ProductShell } from '@/components/product/app-shell';
import {
  approveCustomChallengeDraftAction,
  createAssessmentAction,
  createCustomChallengeDraftAction,
} from '@/lib/actions/assessments';
import { requireHiringUser } from '@/lib/auth/demo-auth';
import {
  CUSTOM_FOCUS_SKILLS,
  CUSTOM_TASK_DOMAINS,
  CUSTOM_TASK_TYPES,
  isDraftDifficulty,
} from '@/lib/challenge-builder/templates';
import { validateChallengeDraftFiles } from '@/lib/challenge-builder/validation';
import { ensureChallengeCatalog } from '@/lib/challenge-catalog';
import { db } from '@/lib/db';
import { parseJson } from '@/lib/json';

export default async function NewAssessmentPage({
  searchParams,
}: {
  searchParams?: { customChallengeId?: string };
}) {
  await requireHiringUser('/dashboard/assessments/new');
  await ensureChallengeCatalog();

  const challenges = await db.challenge.findMany({
    include: { files: { orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ createdAt: 'desc' }, { title: 'asc' }],
  });
  const customChallengeId = searchParams?.customChallengeId;
  const selectedChallenge = challenges.find((challenge) => challenge.id === customChallengeId) || challenges[0];
  const selectedStack = parseJson<string[]>(selectedChallenge?.stackJson, []);
  const hasDraftReady = Boolean(customChallengeId && selectedChallenge?.id === customChallengeId);
  const selectedIsDraft = Boolean(selectedChallenge && isDraftDifficulty(selectedChallenge.difficulty));
  const selectedValidation = selectedChallenge ? validateChallengeDraftFiles(selectedChallenge.files) : null;

  return (
    <ProductShell title="Create assessment" subtitle="Choose a curated template or draft a controlled custom task.">
      {hasDraftReady && (
        <div className="mb-5 rounded-lg border border-emerald-600/20 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          Draft template ready. Review it below, then create an assessment from it when the brief looks right.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-6">
          <form action={createAssessmentAction} className="rounded-xl border border-black/10 bg-white/65 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/45">Assessment setup</p>
                <h2 className="mt-2 text-xl font-black">Create from catalog</h2>
              </div>
              <FileCode2 className="h-5 w-5 text-black/35" />
            </div>

            <div className="mt-6 grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm font-bold">Assessment title</span>
                <input
                  name="title"
                  defaultValue={selectedChallenge ? `${selectedChallenge.role} Screen` : 'Engineering Assessment'}
                  className="h-11 rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#d12864]"
                  required
                />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-bold">Role</span>
                  <input
                    name="role"
                    defaultValue={selectedChallenge?.role || 'Full-stack Engineer'}
                    className="h-11 rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#d12864]"
                    required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold">Seniority</span>
                  <select
                    name="seniority"
                    defaultValue="Mid-Senior"
                    className="h-11 rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#d12864]"
                  >
                    <option>Junior</option>
                    <option>Mid</option>
                    <option>Mid-Senior</option>
                    <option>Senior</option>
                    <option>Staff</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-bold">Duration</span>
                  <select
                    name="durationMinutes"
                    defaultValue={String(selectedChallenge?.durationMinutes || 60)}
                    className="h-11 rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#d12864]"
                  >
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="75">75 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="120">120 minutes</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold">AI mode</span>
                  <select
                    name="aiMode"
                    defaultValue="allowed"
                    className="h-11 rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#d12864]"
                  >
                    <option value="allowed">Allowed and logged</option>
                    <option value="required">Required</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-bold">Challenge template</span>
                <select
                  name="challengeId"
                  defaultValue={selectedChallenge?.id}
                  className="h-11 rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#d12864]"
                >
                  {challenges.map((challenge) => (
                    <option key={challenge.id} value={challenge.id}>
                      {challenge.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-lg border border-black/10 bg-[#f7f0e7] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/45">Selected template</p>
                    <h3 className="mt-2 font-black">{selectedChallenge?.title}</h3>
                  </div>
                  {selectedIsDraft && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-900">
                      Draft
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-black/65">{selectedChallenge?.scenario}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedStack.map((item) => (
                    <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-black/60">
                      {item}
                    </span>
                  ))}
                </div>
                {selectedValidation && (
                  <div className="mt-4 rounded-md border border-black/10 bg-white/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-black/45">Validation gate</p>
                      <span className="rounded-full bg-[#111] px-2.5 py-1 text-[11px] font-bold text-paper">
                        {selectedValidation.status === 'blocked' ? 'Blocked' : 'Review ready'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-black/60">
                      {selectedValidation.errorCount} errors, {selectedValidation.warningCount} warnings. Allowed commands:{' '}
                      {selectedValidation.allowedCommands.join(', ')}.
                    </p>
                    {selectedValidation.issues.length > 0 && (
                      <ul className="mt-2 grid gap-1 text-xs text-black/60">
                        {selectedValidation.issues.slice(0, 3).map((issue) => (
                          <li key={`${issue.code}-${issue.path || 'global'}`}>
                            <span className="font-black">{issue.severity.toUpperCase()}:</span> {issue.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-black/10 pt-5">
                <Link href="/dashboard" className="text-sm font-bold text-black/55 hover:text-black">
                  Cancel
                </Link>
                {selectedIsDraft ? (
                  <span className="text-sm font-bold text-amber-800">Approve this draft before assessment creation.</span>
                ) : (
                  <button type="submit" className="rounded-md bg-[#111] px-5 py-2.5 text-sm font-bold text-paper hover:bg-black">
                    Create assessment
                  </button>
                )}
              </div>
            </div>
          </form>

          {selectedChallenge && selectedIsDraft && selectedValidation && (
            <section className="rounded-xl border border-amber-400/35 bg-amber-50 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-900/70">Draft review gate</p>
              <h2 className="mt-2 text-xl font-black text-amber-950">Approve before publishing</h2>
              <p className="mt-2 text-sm leading-6 text-amber-950/70">
                Custom tasks stay in draft until their file paths, brief, test scaffold, command policy, and secret scan are review ready.
              </p>
              <div className="mt-4 grid gap-2 text-sm text-amber-950/75">
                {selectedValidation.evidenceChecklist.map((item) => (
                  <div key={item} className="rounded-md border border-amber-300/60 bg-white/70 px-3 py-2 font-semibold">
                    {item}
                  </div>
                ))}
              </div>
              <form action={approveCustomChallengeDraftAction} className="mt-5">
                <input type="hidden" name="challengeId" value={selectedChallenge.id} />
                <button
                  type="submit"
                  disabled={selectedValidation.status === 'blocked'}
                  className="rounded-md bg-[#111] px-5 py-2.5 text-sm font-black text-paper disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Approve custom template
                </button>
              </form>
            </section>
          )}

          <section id="catalog" className="rounded-xl border border-black/10 bg-white/55 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/45">Catalog</p>
                <h2 className="mt-2 text-xl font-black">Curated challenge templates</h2>
              </div>
              <span className="rounded-full bg-[#111] px-3 py-1 text-xs font-bold text-paper">{challenges.length} templates</span>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {challenges.map((challenge) => {
                const stack = parseJson<string[]>(challenge.stackJson, []);
                return (
                  <article key={challenge.id} className="rounded-lg border border-black/10 bg-white/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-black">{challenge.title}</h3>
                      <span className="shrink-0 rounded-full bg-[#f7f0e7] px-2.5 py-1 text-[11px] font-bold text-black/55">
                        {isDraftDifficulty(challenge.difficulty) ? 'Draft' : `${challenge.durationMinutes} min`}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-black/62">{challenge.scenario}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {stack.slice(0, 4).map((item) => (
                        <span key={item} className="rounded-full border border-black/10 px-2.5 py-1 text-[11px] font-bold text-black/55">
                          {item}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs font-semibold text-black/45">
                      {challenge.role} - {challenge.difficulty} - {challenge.files.length} files
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="rounded-xl border border-black/10 bg-[#111] p-6 text-paper">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-paper/45">Interviewer builder</p>
              <h2 className="mt-2 text-2xl font-black">Custom task draft</h2>
            </div>
            <Sparkles className="h-5 w-5 text-paper/45" />
          </div>
          <p className="mt-3 text-sm leading-6 text-paper/65">
            This creates a deterministic draft template for review. It does not publish a custom rubric or claim automated task quality.
          </p>

          <form action={createCustomChallengeDraftAction} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold">Task title</span>
              <input
                name="title"
                defaultValue="Payments Webhook Debugging"
                className="h-11 rounded-md border border-white/10 bg-white/10 px-3 text-sm text-paper outline-none placeholder:text-paper/35 focus:border-paper/60"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <label className="grid gap-2">
                <span className="text-sm font-bold">Role</span>
                <input
                  name="role"
                  defaultValue="Backend Engineer"
                  className="h-11 rounded-md border border-white/10 bg-white/10 px-3 text-sm text-paper outline-none focus:border-paper/60"
                  required
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold">Seniority</span>
                <select
                  name="seniority"
                  defaultValue="Senior"
                  className="h-11 rounded-md border border-white/10 bg-white/10 px-3 text-sm text-paper outline-none focus:border-paper/60"
                >
                  <option className="text-black">Junior</option>
                  <option className="text-black">Mid</option>
                  <option className="text-black">Senior</option>
                  <option className="text-black">Staff</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <label className="grid gap-2">
                <span className="text-sm font-bold">Task type</span>
                <select
                  name="taskType"
                  defaultValue="Bug fix"
                  className="h-11 rounded-md border border-white/10 bg-white/10 px-3 text-sm text-paper outline-none focus:border-paper/60"
                >
                  {CUSTOM_TASK_TYPES.map((taskType) => (
                    <option key={taskType} className="text-black">{taskType}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold">Domain</span>
                <select
                  name="domain"
                  defaultValue="Payments"
                  className="h-11 rounded-md border border-white/10 bg-white/10 px-3 text-sm text-paper outline-none focus:border-paper/60"
                >
                  {CUSTOM_TASK_DOMAINS.map((domain) => (
                    <option key={domain} className="text-black">{domain}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <label className="grid gap-2">
                <span className="text-sm font-bold">Duration</span>
                <select
                  name="durationMinutes"
                  defaultValue="90"
                  className="h-11 rounded-md border border-white/10 bg-white/10 px-3 text-sm text-paper outline-none focus:border-paper/60"
                >
                  <option className="text-black" value="45">45 minutes</option>
                  <option className="text-black" value="60">60 minutes</option>
                  <option className="text-black" value="90">90 minutes</option>
                  <option className="text-black" value="120">120 minutes</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold">Failure mode</span>
                <select
                  name="failureMode"
                  defaultValue="Duplicate webhook events"
                  className="h-11 rounded-md border border-white/10 bg-white/10 px-3 text-sm text-paper outline-none focus:border-paper/60"
                >
                  <option className="text-black">Duplicate webhook events</option>
                  <option className="text-black">Permission leak</option>
                  <option className="text-black">Concurrent race condition</option>
                  <option className="text-black">Partial failure handling</option>
                  <option className="text-black">Assistant boundary violation</option>
                  <option className="text-black">Stale dashboard state</option>
                </select>
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Stack</span>
              <input
                name="stack"
                defaultValue="TypeScript, Node.js, Prisma, Testing"
                className="h-11 rounded-md border border-white/10 bg-white/10 px-3 text-sm text-paper outline-none focus:border-paper/60"
                required
              />
            </label>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-bold">Signals to test</legend>
              {CUSTOM_FOCUS_SKILLS.slice(0, 4).map((skill) => (
                <label key={skill} className="flex items-center gap-2 text-sm text-paper/70">
                  <input name="focusSkills" type="checkbox" value={skill} defaultChecked className="h-4 w-4 accent-[#d12864]" />
                  {skill}
                </label>
              ))}
            </fieldset>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Custom context</span>
              <textarea
                name="context"
                defaultValue="The provider retries successful webhook events during network instability, and some orders are confirmed twice."
                className="min-h-28 resize-y rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm leading-6 text-paper outline-none focus:border-paper/60"
                required
              />
            </label>

            <button type="submit" className="mt-2 rounded-md bg-paper px-4 py-2.5 text-sm font-black text-[#111] hover:bg-white">
              Create draft template
            </button>
          </form>
        </aside>
      </div>
    </ProductShell>
  );
}
