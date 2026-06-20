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

function isSupported(language: string): language is DesignLanguage {
  return (DESIGN_LANGUAGES as string[]).includes(language);
}

export function getDesignBoilerplate(language: string, spec: DesignSpec): string {
  if (language === 'cpp') return cppDesignBoilerplate(spec);
  if (language === 'java') return javaDesignBoilerplate(spec);
  if (language === 'javascript') return jsDesignBoilerplate(spec);
  return '';
}

export function getAllDesignBoilerplates(spec: DesignSpec): Record<DesignLanguage, string> {
  return {
    cpp: cppDesignBoilerplate(spec),
    java: javaDesignBoilerplate(spec),
    javascript: jsDesignBoilerplate(spec),
  };
}

export function wrapDesignSource(language: string, spec: DesignSpec, userCode: string): string {
  if (!isSupported(language)) throw new Error(`Unsupported design language: ${language}`);
  if (language === 'cpp') return cppDesignWrap(spec, userCode);
  if (language === 'java') return javaDesignWrap(spec, userCode);
  return jsDesignWrap(spec, userCode);
}
