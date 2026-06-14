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

function isSupported(language: string): language is HarnessLanguage {
  return (SUPPORTED_LANGUAGES as string[]).includes(language);
}

// The visible function stub the candidate edits (per language).
export function getBoilerplate(language: string, sig: Signature): string {
  if (language === 'cpp') return cppBoilerplate(sig);
  if (language === 'java') return javaBoilerplate(sig);
  if (language === 'javascript') return javascriptBoilerplate(sig);
  return '';
}

// All visible boilerplates for a problem, keyed by language.
export function getAllBoilerplates(sig: Signature): Record<HarnessLanguage, string> {
  return {
    cpp: cppBoilerplate(sig),
    java: javaBoilerplate(sig),
    javascript: javascriptBoilerplate(sig),
  };
}

// Wraps the candidate's function with the hidden driver -> full source for Judge0.
export function wrapSource(language: string, sig: Signature, userCode: string): string {
  if (!isSupported(language)) {
    throw new Error(`Unsupported harness language: ${language}`);
  }
  if (language === 'cpp') return cppWrap(sig, userCode);
  if (language === 'java') return javaWrap(sig, userCode);
  return javascriptWrap(sig, userCode);
}
