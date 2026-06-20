import type { DesignScalar, DesignSpec } from '@/lib/judge/harness/design/types';

const JAVA_TYPE: Record<DesignScalar, string> = {
  int: 'int',
  long: 'long',
  double: 'double',
  bool: 'boolean',
  string: 'String',
};
const JAVA_RET: Record<string, string> = { ...JAVA_TYPE, void: 'void' };
const JAVA_DEFAULT: Record<DesignScalar, string> = {
  int: '0',
  long: '0',
  double: '0',
  bool: 'false',
  string: '""',
};

function conv(type: DesignScalar, expr: string) {
  if (type === 'int') return `Integer.parseInt(${expr})`;
  if (type === 'long') return `Long.parseLong(${expr})`;
  if (type === 'double') return `Double.parseDouble(${expr})`;
  if (type === 'bool') return `${expr}.equals("true")`;
  return expr; // string
}

export function javaDesignBoilerplate(spec: DesignSpec) {
  const ctor = spec.constructorParams.map((p) => `${JAVA_TYPE[p.type]} ${p.name}`).join(', ');
  const methods = spec.methods
    .map((m) => {
      const params = m.params.map((p) => `${JAVA_TYPE[p.type]} ${p.name}`).join(', ');
      const body =
        m.returnType === 'void'
          ? '        // Write your solution here'
          : `        // Write your solution here\n        return ${JAVA_DEFAULT[m.returnType]};`;
      return `    public ${JAVA_RET[m.returnType]} ${m.name}(${params}) {\n${body}\n    }`;
    })
    .join('\n\n');
  return `class ${spec.className} {\n    public ${spec.className}(${ctor}) {\n        // Initialize your data structure here\n    }\n\n${methods}\n}`;
}

export function javaDesignWrap(spec: DesignSpec, userCode: string) {
  const ctorArgs = spec.constructorParams.map((p, i) => conv(p.type, `_ct[${i}]`)).join(', ');
  const branches = spec.methods
    .map((m) => {
      const args = m.params.map((p, i) => conv(p.type, `_a[${i}]`)).join(', ');
      const call = `_obj.${m.name}(${args})`;
      if (m.returnType === 'void') return `            if (_name.equals(${JSON.stringify(m.name)})) { ${call}; continue; }`;
      if (m.returnType === 'bool') return `            if (_name.equals(${JSON.stringify(m.name)})) { boolean _r = ${call}; _sb.append(_r ? "true" : "false").append("\\n"); continue; }`;
      return `            if (_name.equals(${JSON.stringify(m.name)})) { _sb.append(${call}).append("\\n"); continue; }`;
    })
    .join('\n');

  return `import java.util.*;
import java.io.*;

${userCode}

// ---- Hirewave design driver (do not edit) ----
public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader _br = new BufferedReader(new InputStreamReader(System.in));
        List<String> _L = new ArrayList<>();
        String _ln;
        while ((_ln = _br.readLine()) != null) _L.add(_ln);
        int _p = 0;
        String _ctLine = _p < _L.size() ? _L.get(_p++) : "";
        String[] _ct = _ctLine.trim().isEmpty() ? new String[0] : _ctLine.trim().split("\\s+");
        ${spec.className} _obj = new ${spec.className}(${ctorArgs});
        String _qs = _p < _L.size() ? _L.get(_p++) : "0";
        int _q = _qs.trim().isEmpty() ? 0 : Integer.parseInt(_qs.trim());
        StringBuilder _sb = new StringBuilder();
        for (int _i = 0; _i < _q; _i++) {
            String _line = _p < _L.size() ? _L.get(_p++) : "";
            String[] _a0 = _line.trim().isEmpty() ? new String[0] : _line.trim().split("\\s+");
            if (_a0.length == 0) continue;
            String _name = _a0[0];
            String[] _a = Arrays.copyOfRange(_a0, 1, _a0.length);
${branches}
        }
        System.out.print(_sb);
    }
}
`;
}
