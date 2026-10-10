// Prints every topic's checkable parts as JSON (used by tools/mathcheck.py and by writers).
//   node tools/dump-content.js            all topics
//   node tools/dump-content.js a1-slope   one topic
const fs = require('fs'), path = require('path'), vm = require('vm');
const { dataFiles, R } = require('./build-web.js');
const ctx = vm.createContext({}); ctx.window = ctx;
for (const f of dataFiles) vm.runInContext(fs.readFileSync(path.join(R, f), 'utf8'), ctx, { filename: f });
const field = {}; for (const [f, t] of Object.entries(ctx.DB.trees)) for (const n of t.nodes) field[n.id] = f;
const want = process.argv.slice(2);
const out = {};
for (const [id, t] of Object.entries(ctx.ARITH)) {
  if (want.length && !want.includes(id)) continue;
  // block lessons (concept.ideas): every layer is dumped, so walk lines, predictions, task answers and formal checks are hashed too
  out[id] = { field: field[id], title: t.title, formal: t.formal, steps: t.steps, example: t.example, practice: t.practice, mistakes: t.mistakes, ...(t.stories ? { stories: t.stories } : {}), ...(t.layers ? { layers: (t.layers.concept || {}).ideas ? t.layers : { examples: (t.layers.concept || {}).examples, setup: (t.layers.formal || {}).setup } } : {}) };
}
process.stdout.write(JSON.stringify(out, null, 1));
