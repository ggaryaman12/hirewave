import { Language } from '@/lib/constants';

// Registry of FIRST-CLASS languages — those with full harness support
// (boilerplate, hidden-test drivers, judging). This is the single place that
// holds per-language metadata. To add a language: add one entry here. Because
// LANGUAGE_DEFS is keyed by the Language union, the compiler then flags every
// Record<Language, …> that's missing the new key — a compiler-checked to-do list.
//
// NOTE: Judge0 can additionally RUN languages it knows but we don't treat as
// first-class (c, go, rust, …) — those are passthrough aliases kept in
// judge0-provider, not here.
export interface LanguageDef {
  id: Language;
  label: string; // UI label, e.g. "C++"
  monacoId: string; // Monaco editor language id
  judge0Id: number; // Judge0 submission language_id
  timeFactor: number; // wall-clock multiplier in grading (slower runtimes get headroom)
}

export const LANGUAGE_DEFS: Record<Language, LanguageDef> = {
  [Language.CPP]: { id: Language.CPP, label: 'C++', monacoId: 'cpp', judge0Id: 54, timeFactor: 1 },
  [Language.JAVA]: { id: Language.JAVA, label: 'Java', monacoId: 'java', judge0Id: 62, timeFactor: 2 },
  [Language.JAVASCRIPT]: { id: Language.JAVASCRIPT, label: 'JavaScript', monacoId: 'javascript', judge0Id: 63, timeFactor: 2 },
};

export const LANGUAGE_LIST: LanguageDef[] = Object.values(LANGUAGE_DEFS);

export function getLanguageDef(language: string): LanguageDef | undefined {
  return LANGUAGE_DEFS[language.toLowerCase() as Language];
}
