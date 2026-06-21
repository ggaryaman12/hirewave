import * as acorn from 'acorn';

export const MAX_STEPS = 5000;
export const OP_CEILING = 5_000_000;
export const MAX_VARS = 12;

type Node = acorn.Node & Record<string, any>;

// Collect candidate variable names declared directly in a function scope
// (params + var/let/const/inner-function ids), NOT descending into nested
// functions. Used to build a per-statement variable snapshot thunk.
function scopeVars(fnBody: Node, params: Node[]): string[] {
  const names = new Set<string>();
  for (const p of params) if (p?.type === 'Identifier') names.add(p.name);
  (function walk(n: Node, top: boolean) {
    if (!n || typeof n.type !== 'string') return;
    if (!top && (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression')) {
      if (n.type === 'FunctionDeclaration' && n.id) names.add(n.id.name);
      return; // do not descend into nested function scopes
    }
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier') names.add(n.id.name);
    for (const k of Object.keys(n)) {
      const c = (n as any)[k];
      if (Array.isArray(c)) c.forEach((x) => x && x.type && walk(x, false));
      else if (c && c.type) walk(c, false);
    }
  })(fnBody, true);
  return [...names].slice(0, MAX_VARS);
}

// Build a TDZ/undefined-safe snapshot thunk: each var is read through __cx.g
// so a ReferenceError (not yet declared) yields undefined instead of throwing.
function varThunk(names: string[]): string {
  if (!names.length) return 'null';
  const fields = names.map((n) => `${JSON.stringify(n)}:__cx.g(function(){return ${n};})`).join(',');
  return `function(){return {${fields}};}`;
}

export function instrumentJs(code: string): string {
  const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true, ranges: true }) as unknown as Node;

  // priority: lower number = applied later in the reverse pass = appears earlier in output.
  // enter (0) must appear before t-ticks (1) when they share the same insert position.
  type Ins = { pos: number; text: string; pri: number };
  const inserts: Ins[] = [];

  // Map each statement to its nearest enclosing function's candidate vars.
  // inBlock=true means this node is a direct child of a BlockStatement body array,
  // so it is safe to prepend a standalone statement before it.
  (function walk(n: Node, scope: string[], inBlock: boolean) {
    if (!n || typeof n.type !== 'string') return;
    let childScope = scope;

    const isFn = n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';
    if (isFn && n.body?.type === 'BlockStatement' && n.body.range) {
      const name = n.id?.name || (n.type === 'ArrowFunctionExpression' ? 'arrow' : 'anonymous');
      childScope = scopeVars(n.body, n.params || []);
      const bStart = n.body.range[0]; // position of '{'
      const bEnd = n.body.range[1];   // position just after '}'
      inserts.push({ pos: bStart + 1, text: `__cx.enter(${JSON.stringify(name)});try{`, pri: 0 });
      inserts.push({ pos: bEnd - 1, text: `}finally{__cx.exit();}`, pri: 0 });
    }

    // Only tick statements that are direct members of a BlockStatement body.
    // Ticking the body of a bare if/for/while (no braces) would make the
    // prepended __cx.t() steal control from the branch statement.
    if (inBlock && n.type.endsWith('Statement') && n.type !== 'BlockStatement' && n.range && n.loc) {
      inserts.push({ pos: n.range[0], text: `__cx.t(${n.loc.start.line},${varThunk(scope)});`, pri: 1 });
    }

    // Recurse. Children in a block-body array (BlockStatement.body or Program.body)
    // get inBlock=true so they can be safely prepended with a standalone __cx.t().
    // All other child positions get inBlock=false to avoid breaking bare-body branches.
    const isBlockLike = n.type === 'BlockStatement' || n.type === 'Program';
    if (isBlockLike && Array.isArray(n.body)) {
      n.body.forEach((x: Node) => x && x.type && walk(x, childScope, true));
      // Also walk other keys (e.g. Program directives) but they are rarely present
    } else {
      for (const k of Object.keys(n)) {
        const c = (n as any)[k];
        if (Array.isArray(c)) c.forEach((x) => x && x.type && walk(x, childScope, false));
        else if (c && c.type) walk(c, childScope, false);
      }
    }
  })(ast, [], false);

  // Splice from the end so earlier offsets stay valid.
  // For equal positions: higher pri is processed first (sorted earlier in descending list),
  // so it gets prepended last and ends up earliest in the output.
  // pri=1 (t-tick) processed first → pri=0 (enter) processed second → enter appears before t in output.
  inserts.sort((a, b) => b.pos - a.pos || b.pri - a.pri);
  let out = code;
  for (const ins of inserts) out = out.slice(0, ins.pos) + ins.text + out.slice(ins.pos);

  const runtime = `
var __cx = (function(){
  var ops=0, hits={}, steps=[], truncated=false, stack=[], MAX=${MAX_STEPS}, CAP=${OP_CEILING}, MAXV=${MAX_VARS};
  function snap(thunk){
    var o={}; if(!thunk) return o;
    var raw; try{ raw=thunk(); }catch(e){ return o; }
    if(!raw) return o;
    var keys=Object.keys(raw); for(var i=0;i<keys.length && i<MAXV;i++){
      var v=raw[keys[i]]; if(v===undefined) continue;
      try{ o[keys[i]]=(typeof v==='object'? JSON.stringify(v): String(v)).slice(0,80); }catch(e){ o[keys[i]]='?'; }
    }
    return o;
  }
  return {
    g: function(f){ try{ return f(); }catch(e){ return undefined; } },
    enter: function(name){ stack.push(name); },
    exit: function(){ stack.pop(); },
    t: function(line, thunk){
      ops++; hits[line]=(hits[line]||0)+1;
      if(steps.length<MAX){ steps.push({idx:steps.length,lineNumber:line,recursionDepth:Math.max(0,stack.length-1),callStack:stack.slice(),variables:snap(thunk)}); }
      else { truncated=true; }
      if(ops>CAP){ throw new Error('__CX_OP_CEILING__'); }
    },
    flush: function(){ console.log('__CX__'+JSON.stringify({ops:ops,hits:hits,steps:steps,truncated:truncated})); }
  };
})();
globalThis.__cx = __cx;
function __cx_flush(){ __cx.flush(); }
`;
  return runtime + '\n' + out + '\nif (typeof __cx_flush==="function") __cx_flush();';
}
