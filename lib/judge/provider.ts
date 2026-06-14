import { Judge0Provider } from '@/lib/judge/judge0-provider';
import { LocalJudgeProvider } from '@/lib/judge/local-provider';
import type { JudgeProvider } from '@/lib/judge/types';

// JUDGE_PROVIDER selects the execution engine.
//   judge0 -> self-hosted Judge0 (production; needs JUDGE0_URL)
//   local  -> deterministic in-process provider (tests/dev only)
export function getJudgeProvider(name = process.env.JUDGE_PROVIDER || 'judge0'): JudgeProvider {
  const normalized = name.trim().toLowerCase();
  if (normalized === 'local') return new LocalJudgeProvider();
  return new Judge0Provider();
}
