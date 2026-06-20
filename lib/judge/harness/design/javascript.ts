import type { DesignScalar, DesignSpec } from '@/lib/judge/harness/design/types';

function conv(type: DesignScalar, expr: string) {
  if (type === 'bool') return `(${expr} === 'true')`;
  if (type === 'string') return expr;
  return `Number(${expr})`;
}

export function jsDesignBoilerplate(spec: DesignSpec) {
  const ctor = spec.constructorParams.map((p) => p.name).join(', ');
  const methods = spec.methods
    .map((m) => {
      const params = m.params.map((p) => p.name).join(', ');
      const ret = m.returnType === 'void' ? '' : '\n    // return ...';
      return `  ${m.name}(${params}) {\n    // Write your solution here${ret}\n  }`;
    })
    .join('\n\n');
  return `class ${spec.className} {\n  constructor(${ctor}) {\n    // Initialize your data structure here\n  }\n\n${methods}\n}`;
}

export function jsDesignWrap(spec: DesignSpec, userCode: string) {
  const lines: string[] = [];
  lines.push('const _data = require("fs").readFileSync(0, "utf8").split(/\\r?\\n/);');
  lines.push('let _p = 0;');
  lines.push('const _line = () => (_p < _data.length ? _data[_p++] : "");');
  lines.push('const _out = [];');
  lines.push('const _ctor = _line().trim();');
  lines.push('const _ctorArgs = _ctor.length ? _ctor.split(/\\s+/) : [];');
  const ctorArgs = spec.constructorParams.map((p, i) => conv(p.type, `_ctorArgs[${i}]`)).join(', ');
  lines.push(`const _obj = new ${spec.className}(${ctorArgs});`);
  lines.push('const _q = parseInt(_line().trim() || "0", 10);');
  lines.push('for (let _i = 0; _i < _q; _i++) {');
  lines.push('  const _t = _line().trim(); if (!_t) continue;');
  lines.push('  const _tok = _t.split(/\\s+/); const _name = _tok[0]; const _a = _tok.slice(1);');
  for (const m of spec.methods) {
    const args = m.params.map((p, i) => conv(p.type, `_a[${i}]`)).join(', ');
    const call = `_obj.${m.name}(${args})`;
    if (m.returnType === 'void') {
      lines.push(`  if (_name === ${JSON.stringify(m.name)}) { ${call}; continue; }`);
    } else if (m.returnType === 'bool') {
      lines.push(`  if (_name === ${JSON.stringify(m.name)}) { _out.push(${call} ? "true" : "false"); continue; }`);
    } else {
      lines.push(`  if (_name === ${JSON.stringify(m.name)}) { _out.push(String(${call})); continue; }`);
    }
  }
  lines.push('}');
  lines.push('console.log(_out.join("\\n"));');

  return `${userCode}\n\n// ---- Hirewave design driver (do not edit) ----\n${lines.join('\n')}\n`;
}
