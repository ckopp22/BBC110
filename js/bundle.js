// A tiny, purpose-built bundler for our own ES modules: fetches a module and everything it imports,
// strips import/export syntax (regex, not a real parser — fine because we control every input file),
// and concatenates them into one script where each module is an IIFE assigned to a `MOD_<key>` var.
// Used only by export.js to build the standalone HTML export; never shipped to the main app.

const keyOf = (path) => path.replace(/[^a-zA-Z0-9]/g, '_');

function resolve(fromPath, spec) {
  const base = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/') + 1) : '';
  const parts = (base + spec).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '.' || p === '') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/').replace(/\.js$/, '') + '.js';
}

// Matches `import X from 'y'`, `import { a, b as c } from 'y'`, `import * as n from 'y'`.
const IMPORT_RE = /^import\s+(?:\*\s+as\s+(\w+)|\{([^}]*)\}|(\w+))\s+from\s+['"]([^'"]+)['"];?\s*$/gm;
const EXPORT_NAME_RE = /^export\s+(?:async\s+)?(?:function|class)\s+(\w+)|^export\s+(?:const|let|var)\s+(\w+)/gm;

async function fetchText(root, path) {
  const res = await fetch(new URL(path, root));
  if (!res.ok) throw new Error(`Could not load ${path} for export`);
  return res.text();
}

// root: base URL that module paths (e.g. 'renderer.js', 'elements/text.js') resolve against.
export async function bundleModules(root, entryPaths) {
  const sources = new Map(); // path -> raw source
  const deps = new Map(); // path -> [imported paths]

  async function load(path) {
    if (sources.has(path)) return;
    sources.set(path, '');
    const src = await fetchText(root, path);
    sources.set(path, src);
    const d = [];
    for (const m of src.matchAll(IMPORT_RE)) d.push(resolve(path, m[4]));
    deps.set(path, d);
    for (const dep of d) await load(dep);
  }
  for (const p of entryPaths) await load(p);

  // Topological order so a module's dependencies are defined before it.
  const order = [], seen = new Set();
  function visit(path) {
    if (seen.has(path)) return;
    seen.add(path);
    for (const d of deps.get(path) || []) visit(d);
    order.push(path);
  }
  [...sources.keys()].forEach(visit);

  let out = '';
  for (const path of order) {
    const raw = sources.get(path);
    const exportNames = [...raw.matchAll(EXPORT_NAME_RE)].map((m) => m[1] || m[2]);
    let body = raw.replace(IMPORT_RE, (full, ns, named, def, spec) => {
      const dep = `MOD_${keyOf(resolve(path, spec))}`;
      if (ns) return `const ${ns} = ${dep};`;
      if (named) return `const {${named.replace(/\s+as\s+/g, ': ')}} = ${dep};`;
      if (def) return `const ${def} = ${dep}.default;`;
      return '';
    });
    body = body.replace(/^export\s+(async\s+)?(function|class)\s+/gm, '$1$2 ').replace(/^export\s+(const|let|var)\s+/gm, '$1 ');
    out += `const MOD_${keyOf(path)} = (function(){\n${body}\nreturn {${exportNames.join(',')}};\n})();\n`;
  }
  return { code: out, entryVar: (p) => `MOD_${keyOf(p)}` };
}
