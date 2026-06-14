import { is2DType, isArrayType, type ParamType, type Signature } from '@/lib/judge/harness/signature';

const CPP_TYPE: Record<ParamType, string> = {
  int: 'int',
  long: 'long long',
  double: 'double',
  bool: 'bool',
  string: 'string',
  'int[]': 'vector<int>',
  'long[]': 'vector<long long>',
  'double[]': 'vector<double>',
  'bool[]': 'vector<bool>',
  'string[]': 'vector<string>',
  'int[][]': 'vector<vector<int>>',
};

function elementBase(type: ParamType) {
  return type.replace(/\[\]/g, '') as 'int' | 'long' | 'double' | 'bool' | 'string';
}

function convToken(base: string, tokenExpr: string) {
  if (base === 'int') return `stoi(${tokenExpr})`;
  if (base === 'long') return `stoll(${tokenExpr})`;
  if (base === 'double') return `stod(${tokenExpr})`;
  if (base === 'bool') return `(${tokenExpr} == "true")`;
  return tokenExpr; // string
}

function cppParam(type: ParamType, name: string) {
  return `${CPP_TYPE[type]} ${name}`;
}

const CPP_DEFAULT: Record<ParamType, string> = {
  int: '0',
  long: '0',
  double: '0',
  bool: 'false',
  string: '""',
  'int[]': '{}',
  'long[]': '{}',
  'double[]': '{}',
  'bool[]': '{}',
  'string[]': '{}',
  'int[][]': '{}',
};

export function cppBoilerplate(sig: Signature) {
  const params = sig.params.map((param) => cppParam(param.type, param.name)).join(', ');
  return `${CPP_TYPE[sig.returnType]} ${sig.functionName}(${params}) {\n    // Write your solution here\n    return ${CPP_DEFAULT[sig.returnType]};\n}`;
}

export function cppWrap(sig: Signature, userCode: string) {
  const body: string[] = [];
  const argNames: string[] = [];

  for (const param of sig.params) {
    const arg = `a_${param.name}`;
    argNames.push(arg);
    if (is2DType(param.type)) {
      body.push(`string rs_${param.name} = _next(); int R_${param.name} = rs_${param.name}.empty() ? 0 : stoi(rs_${param.name});`);
      body.push(`vector<vector<int>> ${arg};`);
      body.push(`for (int r = 0; r < R_${param.name}; r++) { auto tk = _split(_next()); vector<int> row; for (auto &x : tk) row.push_back(stoi(x)); ${arg}.push_back(row); }`);
    } else if (isArrayType(param.type)) {
      const base = elementBase(param.type);
      body.push(`${CPP_TYPE[param.type]} ${arg}; { auto tk = _split(_next()); for (auto &x : tk) ${arg}.push_back(${convToken(base, 'x')}); }`);
    } else if (param.type === 'string') {
      body.push(`string ${arg} = _next();`);
    } else {
      const base = elementBase(param.type);
      body.push(`string s_${param.name} = _next(); ${CPP_TYPE[param.type]} ${arg} = s_${param.name}.empty() ? 0 : ${convToken(base, `s_${param.name}`)};`);
    }
  }

  body.push(`auto _res = ${sig.functionName}(${argNames.join(', ')});`);

  if (is2DType(sig.returnType)) {
    body.push('for (auto &row : _res) { for (size_t i = 0; i < row.size(); i++) { if (i) cout << " "; cout << row[i]; } cout << "\\n"; }');
  } else if (isArrayType(sig.returnType)) {
    if (sig.returnType === 'bool[]') {
      body.push('for (size_t i = 0; i < _res.size(); i++) { if (i) cout << " "; cout << (_res[i] ? "true" : "false"); } cout << "\\n";');
    } else if (sig.returnType === 'double[]') {
      body.push('cout << setprecision(12); for (size_t i = 0; i < _res.size(); i++) { if (i) cout << " "; cout << _res[i]; } cout << "\\n";');
    } else {
      body.push('for (size_t i = 0; i < _res.size(); i++) { if (i) cout << " "; cout << _res[i]; } cout << "\\n";');
    }
  } else if (sig.returnType === 'bool') {
    body.push('cout << (_res ? "true" : "false") << "\\n";');
  } else if (sig.returnType === 'double') {
    body.push('cout << setprecision(12) << _res << "\\n";');
  } else {
    body.push('cout << _res << "\\n";');
  }

  return `#include <bits/stdc++.h>
using namespace std;

${userCode}

// ---- Hirewave driver (do not edit) ----
int main() {
    vector<string> _lines;
    string _line;
    while (getline(cin, _line)) { if (!_line.empty() && _line.back() == '\\r') _line.pop_back(); _lines.push_back(_line); }
    size_t _p = 0;
    auto _next = [&]() -> string { return _p < _lines.size() ? _lines[_p++] : string(); };
    auto _split = [&](const string &s) { vector<string> r; stringstream ss(s); string t; while (ss >> t) r.push_back(t); return r; };
    ${body.join('\n    ')}
    return 0;
}
`;
}
