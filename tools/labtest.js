// Logic tests for lab rules: checks every combination a lab can produce in code, instead of clicking
// through it in a browser. Test files live in tests/<name>.test.js and use these globals:
//   const MT = load('web/kits/subjects/music.js').MusicTheory   run browser files in a DOM-free sandbox (window = sandbox)
//   kits(...) = the universal + categorical kit files, to load before a subject kit: load(...kits(), 'web/kits/subjects/math.js')
//   test('name', () => { … })                            one named test; a throw fails it
//   eq(got, want, 'what')                                deep equality (JSON), with a readable message
//   ok(cond, 'what')                                     any true/false fact
// Keep lab rules (spelling, scoring, which answers are right) in DOM-free functions so they can be tested here.
// English labs keep their rules on EngLab.logic["<topic-id>"] (web/kits/subjects/english.js); their tests are
// checks/labs/<topic-id>.test.js, exporting ({ logic, DB, T, EngLab, test, eq }) => { test(name, cond); eq(name, got, want); }.
// Run:  node tools/labtest.js            all test files
//       node tools/labtest.js music      files whose name contains "music"
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..'), dir = path.join(R, 'tests');
const want = process.argv.slice(2);
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.test.js') && (!want.length || want.some(w => f.includes(w)))).sort() : [];
let pass = 0, checks = 0; const fails = [];
const kdir = d => fs.existsSync(path.join(R, d)) ? fs.readdirSync(path.join(R, d)).filter(f => f.endsWith('.js')).sort().map(f => d + '/' + f) : [];
const kits = () => [...kdir('web/kits/universal'), ...kdir('web/kits/categorical')];
for (const f of files) {
  let current = '';
  const load = (...srcs) => { const ctx = vm.createContext({ console, Math, JSON }); ctx.window = ctx; for (const s of srcs) vm.runInContext(fs.readFileSync(path.join(R, s), 'utf8'), ctx, { filename: s }); return ctx; };
  const eq = (got, exp, what = '') => { checks++; const a = JSON.stringify(got), b = JSON.stringify(exp); if (a !== b) throw new Error(`${what}: got ${a}, want ${b}`); };
  const ok = (c, what = '') => { checks++; if (!c) throw new Error(what || 'condition is false'); };
  const tests = [];
  const test = (name, fn) => tests.push([name, fn]);
  try { vm.runInNewContext(fs.readFileSync(path.join(dir, f), 'utf8'), { load, kits, eq, ok, test, console, Math, JSON, require }, { filename: f }); }
  catch (e) { fails.push(`${f}: crashed while loading: ${e.message}`); continue; }
  for (const [name, fn] of tests) { current = name; try { fn(); pass++; } catch (e) { fails.push(`${f} › ${name}: ${e.message}`); } }
}

// ---- English labs: checks/labs/<id>.test.js against EngLab.logic[id] ----
const edir = path.join(R, 'checks', 'labs');
const etests = fs.existsSync(edir) ? fs.readdirSync(edir).filter(f => f.endsWith('.test.js')).map(f => f.replace(/\.test\.js$/, '')).filter(id => !want.length || want.some(w => id.includes(w))) : [];
if (etests.length) {
  const { files: bfiles } = require('./build-web.js');
  const ectx = vm.createContext({ console, Math, JSON, Date, Set, Map, Array, Object, String, Number, RegExp, Error }); ectx.window = ectx; ectx.LABS = {};
  const eload = f => vm.runInContext(fs.readFileSync(path.join(R, f), 'utf8'), ectx, { filename: f });
  for (const f of bfiles.filter(f => /^web\/src\/data(-[a-z0-9-]+)?\.js$/.test(f) || f.startsWith('web/art/') || f.startsWith('web/content/'))) eload(f);
  for (const f of [...kits(), 'web/kits/subjects/english.js', ...bfiles.filter(f => /^web\/labs\/eng-[^/]+\.js$/.test(f))]) { try { eload(f); } catch (e) { fails.push(`${f}: could not load without a browser (${e.message})`); } }
  const E = ectx.EngLab || { logic: {} };
  for (const id of etests) {
    const logic = E.logic[id];
    if (!logic) { fails.push(`checks/labs/${id}.test.js: EngLab.logic["${id}"] is not defined by any lab file`); continue; }
    let n = 0; const before = fails.length;
    const t = (name, cond, detail) => { checks++; n++; if (!cond) fails.push(`checks/labs/${id}.test.js › ${name}${detail ? ' (' + detail + ')' : ''}`); };
    const e = (name, got, w) => { const a = JSON.stringify(got), b = JSON.stringify(w); t(name, a === b, `got ${a}, want ${b}`); };
    try { require(path.join(edir, id + '.test.js'))({ logic, DB: ectx.DB, T: ectx.ARITH, EngLab: E, test: t, eq: e }); }
    catch (err) { fails.push(`checks/labs/${id}.test.js: crashed: ${err.message}`); }
    if (fails.length === before) pass++;
  }
  for (const id of Object.keys(E.logic)) if (!etests.includes(id) && (!want.length || want.some(w => id.includes(w)))) fails.push(`${id}: has EngLab.logic but no checks/labs/${id}.test.js`);
}
fails.forEach(x => console.log('FAIL ' + x));
console.log(`${files.length + etests.length} test file(s): ${pass} test(s) passed, ${checks} check(s), ${fails.length} failure(s)`);
process.exit(fails.length ? 1 : 0);
