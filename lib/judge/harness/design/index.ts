import { Language } from '@/lib/constants';
import { cppDesignBoilerplate, cppDesignWrap } from '@/lib/judge/harness/design/cpp';
import { javaDesignBoilerplate, javaDesignWrap } from '@/lib/judge/harness/design/java';
import { jsDesignBoilerplate, jsDesignWrap } from '@/lib/judge/harness/design/javascript';
import {
  DESIGN_LANGUAGES,
  parseDesignSpec,
  type DesignLanguage,
  type DesignSpec,
} from '@/lib/judge/harness/design/types';

export { parseDesignSpec, DESIGN_LANGUAGES } from '@/lib/judge/harness/design/types';
export type { DesignSpec, DesignLanguage, DesignMethod, DesignParam, DesignScalar } from '@/lib/judge/harness/design/types';

// Exhaustiveness-checked dispatch tables (Record<DesignLanguage, …> =
// Record<Language, …>): a new language won't compile until it's registered here.
const DESIGN_BOILERPLATE: Record<DesignLanguage, (spec: DesignSpec) => string> = {
  [Language.CPP]: cppDesignBoilerplate,
  [Language.JAVA]: javaDesignBoilerplate,
  [Language.JAVASCRIPT]: jsDesignBoilerplate,
};

const DESIGN_WRAP: Record<DesignLanguage, (spec: DesignSpec, userCode: string) => string> = {
  [Language.CPP]: cppDesignWrap,
  [Language.JAVA]: javaDesignWrap,
  [Language.JAVASCRIPT]: jsDesignWrap,
};

function isSupported(language: string): language is DesignLanguage {
  return (DESIGN_LANGUAGES as string[]).includes(language);
}

export function getDesignBoilerplate(language: string, spec: DesignSpec): string {
  return isSupported(language) ? DESIGN_BOILERPLATE[language](spec) : '';
}

export function getAllDesignBoilerplates(spec: DesignSpec): Record<DesignLanguage, string> {
  return Object.fromEntries(
    DESIGN_LANGUAGES.map((language) => [language, DESIGN_BOILERPLATE[language](spec)]),
  ) as Record<DesignLanguage, string>;
}

export function wrapDesignSource(language: string, spec: DesignSpec, userCode: string): string {
  if (!isSupported(language)) throw new Error(`Unsupported design language: ${language}`);
  return DESIGN_WRAP[language](spec, userCode);
}
