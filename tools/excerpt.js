// A short excerpt of a finished topic page, for writers: the shape and voice of every field without
// reading a 30 KB file. Long HTML is cut; arrays keep their first item and say how many there were.
//   node tools/excerpt.js <topic-id> [field …]       e.g. node tools/excerpt.js g-pythagorean hero legend example
const fs = require('fs'), path = require('path'), vm = require('vm');
const { dataFiles, R } = require('./build-web.js');
const ctx = vm.createContext({}); ctx.window = ctx;
for (const f of dataFiles) vm.runInContext(fs.readFileSync(path.join(R, f), 'utf8'), ctx, { filename: f });
const [id, ...keys] = process.argv.slice(2);
const t = (ctx.ARITH || {})[id]; if (!t) { console.error('usage: node tools/excerpt.js <topic-id> [field …]  (no topic "' + id + '")'); process.exit(1); }
const cut = (v, n) => typeof v === 'string' ? (v.length > n ? v.slice(0, n) + ` …[${v.length} chars]` : v)
  : Array.isArray(v) ? (v.length ? [cut(v[0], n), ...(v.length > 1 ? [`…[${v.length} items]`] : [])] : [])
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cut(x, n)])) : v;
const out = {}; for (const k of keys.length ? keys : Object.keys(t)) out[k] = cut(t[k], keys.length ? 1200 : 260);
console.log(JSON.stringify(out, null, 1));
