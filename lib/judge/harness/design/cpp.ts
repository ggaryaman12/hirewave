import type { DesignScalar, DesignSpec } from '@/lib/judge/harness/design/types';

const CPP_TYPE: Record<DesignScalar, string> = {
  int: 'int',
  long: 'long long',
  double: 'double',
  bool: 'bool',
  string: 'string',
};
const CPP_RET: Record<string, string> = { ...CPP_TYPE, void: 'void' };
const CPP_DEFAULT: Record<DesignScalar, string> = {
  int: '0',
  long: '0',
  double: '0',
  bool: 'false',
  string: '""',
};

function conv(type: DesignScalar, expr: string) {
  if (type === 'int') return `stoi(${expr})`;
  if (type === 'long') return `stoll(${expr})`;
  if (type === 'double') return `stod(${expr})`;
  if (type === 'bool') return `(${expr} == "true")`;
  return expr; // string
}

export function cppDesignBoilerplate(spec: DesignSpec) {
  const ctor = spec.constructorParams.map((p) => `${CPP_TYPE[p.type]} ${p.name}`).join(', ');
  const methods = spec.methods
    .map((m) => {
      const params = m.params.map((p) => `${CPP_TYPE[p.type]} ${p.name}`).join(', ');
      const body =
        m.returnType === 'void'
          ? '        // Write your solution here'
          : `        // Write your solution here\n        return ${CPP_DEFAULT[m.returnType]};`;
      return `    ${CPP_RET[m.returnType]} ${m.name}(${params}) {\n${body}\n    }`;
    })
    .join('\n\n');
  return `class ${spec.className} {\npublic:\n    ${spec.className}(${ctor}) {\n        // Initialize your data structure here\n    }\n\n${methods}\n};`;
}

export function cppDesignWrap(spec: DesignSpec, userCode: string) {
  const ctorArgs = spec.constructorParams.map((p, i) => conv(p.type, `_ct[${i}]`)).join(', ');
  // Zero-arg ctor must be `T _obj;` not `T _obj();` (most-vexing-parse).
  const ctorDecl = ctorArgs ? `${spec.className} _obj(${ctorArgs});` : `${spec.className} _obj;`;
  const branches = spec.methods
    .map((m) => {
      const args = m.params.map((p, i) => conv(p.type, `_a[${i}]`)).join(', ');
      const call = `_obj.${m.name}(${args})`;
      if (m.returnType === 'void') return `        if (_name == ${JSON.stringify(m.name)}) { ${call}; continue; }`;
      if (m.returnType === 'bool') return `        if (_name == ${JSON.stringify(m.name)}) { auto _r = ${call}; cout << (_r ? "true" : "false") << "\\n"; continue; }`;
      return `        if (_name == ${JSON.stringify(m.name)}) { cout << ${call} << "\\n"; continue; }`;
    })
    .join('\n');

  return `#include <bits/stdc++.h>
using namespace std;

${userCode}

// ---- Hirewave design driver (do not edit) ----
int main() {
    cout << setprecision(12);
    vector<string> _L; string _ln;
    while (getline(cin, _ln)) { if (!_ln.empty() && _ln.back() == '\\r') _ln.pop_back(); _L.push_back(_ln); }
    size_t _p = 0;
    auto _next = [&]() -> string { return _p < _L.size() ? _L[_p++] : string(); };
    auto _split = [&](const string &s) { vector<string> r; stringstream ss(s); string t; while (ss >> t) r.push_back(t); return r; };
    auto _ct = _split(_next());
    ${ctorDecl}
    string _qs = _next(); int _q = _qs.empty() ? 0 : stoi(_qs);
    for (int _i = 0; _i < _q; _i++) {
        auto _a0 = _split(_next());
        if (_a0.empty()) continue;
        string _name = _a0[0];
        vector<string> _a(_a0.begin() + 1, _a0.end());
${branches}
    }
    return 0;
}
`;
}
