import { Language } from '@/lib/constants';
import { cppBoilerplate, cppWrap } from '@/lib/judge/harness/cpp';
import { javaBoilerplate, javaWrap } from '@/lib/judge/harness/java';
import { javascriptBoilerplate, javascriptWrap } from '@/lib/judge/harness/javascript';
import {
  SUPPORTED_LANGUAGES,
  type HarnessLanguage,
  type Signature,
} from '@/lib/judge/harness/signature';

export { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, parseSignature } from '@/lib/judge/harness/signature';
export type { HarnessLanguage, Signature, ParamType } from '@/lib/judge/harness/signature';

// Per-language dispatch tables. Because they're Record<HarnessLanguage, …>
// (= Record<Language, …>), adding a language to the union makes these fail to
// compile until the new entry is provided — a guided to-do list, not a runtime
// "Unsupported language" surprise.
const BOILERPLATE: Record<HarnessLanguage, (sig: Signature) => string> = {
  [Language.CPP]: cppBoilerplate,
  [Language.JAVA]: javaBoilerplate,
  [Language.JAVASCRIPT]: javascriptBoilerplate,
};

const WRAP: Record<HarnessLanguage, (sig: Signature, userCode: string) => string> = {
  [Language.CPP]: cppWrap,
  [Language.JAVA]: javaWrap,
  [Language.JAVASCRIPT]: javascriptWrap,
};

function isSupported(language: string): language is HarnessLanguage {
  return (SUPPORTED_LANGUAGES as string[]).includes(language);
}

// The visible function stub the candidate edits (per language).
export function getBoilerplate(language: string, sig: Signature): string {
  return isSupported(language) ? BOILERPLATE[language](sig) : '';
}

// All visible boilerplates for a problem, keyed by language.
export function getAllBoilerplates(sig: Signature): Record<HarnessLanguage, string> {
  return Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [language, BOILERPLATE[language](sig)]),
  ) as Record<HarnessLanguage, string>;
}

// Wraps the candidate's function with the hidden driver -> full source for Judge0.
export function wrapSource(language: string, sig: Signature, userCode: string): string {
  if (!isSupported(language)) {
    throw new Error(`Unsupported harness language: ${language}`);
  }
  return WRAP[language](sig, userCode);
}
