import { is2DType, isArrayType, type ParamType, type Signature } from '@/lib/judge/harness/signature';

function elementType(type: ParamType): 'int' | 'long' | 'double' | 'bool' | 'string' {
  const base = type.replace(/\[\]/g, '') as 'int' | 'long' | 'double' | 'bool' | 'string';
  return base;
}

function convScalar(expr: string, base: string) {
  if (base === 'bool') return `(${expr}).trim() === 'true'`;
  if (base === 'string') return expr;
  return `Number(${expr})`; // int/long/double
}

export function javascriptBoilerplate(sig: Signature) {
  const params = sig.params.map((param) => param.name).join(', ');
  return `function ${sig.functionName}(${params}) {\n  // Write your solution here\n}`;
}

export function javascriptWrap(sig: Signature, userCode: string) {
  const lines: string[] = [];
  lines.push('const _input = require("fs").readFileSync(0, "utf8").split(/\\r?\\n/);');
  lines.push('let _ptr = 0;');
  lines.push('const _next = () => (_ptr < _input.length ? _input[_ptr++] : "");');

  const argNames: string[] = [];
  for (const param of sig.params) {
    const arg = `_arg_${param.name}`;
    argNames.push(arg);
    if (is2DType(param.type)) {
      lines.push(`const _rows_${param.name} = parseInt(_next() || "0", 10);`);
      lines.push(`const ${arg} = [];`);
      lines.push(`for (let _r = 0; _r < _rows_${param.name}; _r++) { const _l = _next().trim(); ${arg}.push(_l === "" ? [] : _l.split(/\\s+/).map(Number)); }`);
    } else if (isArrayType(param.type)) {
      const base = elementType(param.type);
      lines.push(`const _l_${param.name} = _next().trim();`);
      lines.push(`const ${arg} = _l_${param.name} === "" ? [] : _l_${param.name}.split(/\\s+/).map((_v) => ${convScalar('_v', base)});`);
    } else {
      lines.push(`const _l_${param.name} = _next();`);
      lines.push(`const ${arg} = ${convScalar(`_l_${param.name}`, param.type)};`);
    }
  }

  lines.push(`const _result = ${sig.functionName}(${argNames.join(', ')});`);

  // Serialize the return value.
  if (is2DType(sig.returnType)) {
    lines.push('console.log(_result.map((_row) => _row.join(" ")).join("\\n"));');
  } else if (isArrayType(sig.returnType)) {
    lines.push('console.log(_result.join(" "));');
  } else if (sig.returnType === 'bool') {
    lines.push('console.log(_result ? "true" : "false");');
  } else {
    lines.push('console.log(String(_result));');
  }

  return `${userCode}\n\n// ---- Hirewave driver (do not edit) ----\n${lines.join('\n')}\n`;
}
