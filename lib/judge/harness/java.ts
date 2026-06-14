import { is2DType, isArrayType, type ParamType, type Signature } from '@/lib/judge/harness/signature';

const JAVA_TYPE: Record<ParamType, string> = {
  int: 'int',
  long: 'long',
  double: 'double',
  bool: 'boolean',
  string: 'String',
  'int[]': 'int[]',
  'long[]': 'long[]',
  'double[]': 'double[]',
  'bool[]': 'boolean[]',
  'string[]': 'String[]',
  'int[][]': 'int[][]',
};

const JAVA_DEFAULT: Record<ParamType, string> = {
  int: '0',
  long: '0',
  double: '0',
  bool: 'false',
  string: '""',
  'int[]': 'new int[0]',
  'long[]': 'new long[0]',
  'double[]': 'new double[0]',
  'bool[]': 'new boolean[0]',
  'string[]': 'new String[0]',
  'int[][]': 'new int[0][]',
};

function elementBase(type: ParamType) {
  return type.replace(/\[\]/g, '') as 'int' | 'long' | 'double' | 'bool' | 'string';
}

function parseToken(base: string, expr: string) {
  if (base === 'int') return `Integer.parseInt(${expr})`;
  if (base === 'long') return `Long.parseLong(${expr})`;
  if (base === 'double') return `Double.parseDouble(${expr})`;
  if (base === 'bool') return `${expr}.equals("true")`;
  return expr;
}

export function javaBoilerplate(sig: Signature) {
  const params = sig.params.map((param) => `${JAVA_TYPE[param.type]} ${param.name}`).join(', ');
  return `class Solution {\n    public ${JAVA_TYPE[sig.returnType]} ${sig.functionName}(${params}) {\n        // Write your solution here\n        return ${JAVA_DEFAULT[sig.returnType]};\n    }\n}`;
}

export function javaWrap(sig: Signature, userCode: string) {
  const body: string[] = [];
  const argNames: string[] = [];

  for (const param of sig.params) {
    const arg = `a_${param.name}`;
    argNames.push(arg);
    if (is2DType(param.type)) {
      body.push(`String rs_${param.name} = _i < L.size() ? L.get(_i++) : "";`);
      body.push(`int R_${param.name} = rs_${param.name}.trim().isEmpty() ? 0 : Integer.parseInt(rs_${param.name}.trim());`);
      body.push(`int[][] ${arg} = new int[R_${param.name}][];`);
      body.push(`for (int r = 0; r < R_${param.name}; r++) { String rl = _i < L.size() ? L.get(_i++) : ""; String[] tt = rl.trim().isEmpty() ? new String[0] : rl.trim().split("\\\\s+"); int[] row = new int[tt.length]; for (int k = 0; k < tt.length; k++) row[k] = Integer.parseInt(tt[k]); ${arg}[r] = row; }`);
    } else if (isArrayType(param.type)) {
      const base = elementBase(param.type);
      body.push(`String l_${param.name} = _i < L.size() ? L.get(_i++) : "";`);
      body.push(`String[] t_${param.name} = l_${param.name}.trim().isEmpty() ? new String[0] : l_${param.name}.trim().split("\\\\s+");`);
      body.push(`${JAVA_TYPE[param.type]} ${arg} = new ${JAVA_TYPE[base]}[t_${param.name}.length];`);
      body.push(`for (int k = 0; k < t_${param.name}.length; k++) ${arg}[k] = ${parseToken(base, `t_${param.name}[k]`)};`);
    } else if (param.type === 'string') {
      body.push(`String ${arg} = _i < L.size() ? L.get(_i++) : "";`);
    } else {
      const base = elementBase(param.type);
      body.push(`String s_${param.name} = _i < L.size() ? L.get(_i++) : "";`);
      body.push(`${JAVA_TYPE[param.type]} ${arg} = s_${param.name}.trim().isEmpty() ? ${JAVA_DEFAULT[param.type]} : ${parseToken(base, `s_${param.name}.trim()`)};`);
    }
  }

  body.push(`${JAVA_TYPE[sig.returnType]} _res = new Solution().${sig.functionName}(${argNames.join(', ')});`);

  if (is2DType(sig.returnType)) {
    body.push('StringBuilder _sb = new StringBuilder();');
    body.push('for (int r = 0; r < _res.length; r++) { for (int k = 0; k < _res[r].length; k++) { if (k > 0) _sb.append(" "); _sb.append(_res[r][k]); } _sb.append("\\n"); }');
    body.push('System.out.print(_sb);');
  } else if (isArrayType(sig.returnType)) {
    body.push('StringBuilder _sb = new StringBuilder();');
    if (sig.returnType === 'bool[]') {
      body.push('for (int k = 0; k < _res.length; k++) { if (k > 0) _sb.append(" "); _sb.append(_res[k] ? "true" : "false"); }');
    } else {
      body.push('for (int k = 0; k < _res.length; k++) { if (k > 0) _sb.append(" "); _sb.append(_res[k]); }');
    }
    body.push('System.out.println(_sb);');
  } else if (sig.returnType === 'bool') {
    body.push('System.out.println(_res ? "true" : "false");');
  } else {
    body.push('System.out.println(_res);');
  }

  return `import java.util.*;
import java.io.*;

${userCode}

// ---- Hirewave driver (do not edit) ----
public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader _br = new BufferedReader(new InputStreamReader(System.in));
        List<String> L = new ArrayList<>();
        String _ln;
        while ((_ln = _br.readLine()) != null) L.add(_ln);
        int _i = 0;
        ${body.join('\n        ')}
    }
}
`;
}
