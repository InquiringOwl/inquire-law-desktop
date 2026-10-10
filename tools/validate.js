// Checks the Inquire data and content for structural mistakes before a build or release.
// Run: node tools/validate.js        (exit code 1 on any error; warnings don't fail)
// Covers: skill trees (ids, prereqs, cycles, layout), field map, every topic dossier's
// fields and types, raw-HTML tag balance, escaped-text fields, and lab coverage.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { files, dataFiles, R } = require('./build-web.js');

const errors = [], warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

// ---- load data + content (labs need a DOM, so they are scanned as text instead) ----
const ctx = vm.createContext({ console, Math });
ctx.window = ctx;
for (const f of dataFiles) {
  try { vm.runInContext(fs.readFileSync(path.join(R, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { err(f, 'failed to load: ' + e.message); }
}
const DB = ctx.DB, T = ctx.ARITH || {};
// storyboards (InquireDemo, web/kits/categorical/demo.js) check their own specs: kinds, ranges, alt text
const DEMO = (() => { const c = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(R, 'web/kits/categorical/demo.js'), 'utf8'), c, { filename: 'demo.js' }); return c.InquireDemo; })();
const demoFrames = d => d.kind === 'dots' || !d.kind ? DEMO.frames(d).length : DEMO.seqFrames(d).length;
if (!DB || !DB.trees) { console.error('DB.trees missing, cannot continue'); process.exit(1); }

// ---- content files: web/content/<field>/<id>.js holding exactly ARITH["<id>"] ----
for (const f of dataFiles.filter(f => f.startsWith('web/content/'))) {
  const m = f.match(/^web\/content\/([a-z0-9-]+)\/([a-z0-9-]+)\.js$/);
  if (!m) { err(f, 'content files belong at web/content/<field>/<topic-id>.js'); continue; }
  const ids = [...fs.readFileSync(path.join(R, f), 'utf8').matchAll(/^ARITH\["([a-z0-9-]+)"\]\s*=/gm)].map(x => x[1]);
  if (ids.length !== 1 || ids[0] !== m[2]) err(f, `should define only ARITH["${m[2]}"] (found ${ids.join(', ') || 'none'})`);
  if (DB.trees && !(DB.trees[m[1]] || { nodes: [] }).nodes.some(n => n.id === m[2])) err(f, `"${m[2]}" is not a node of the ${m[1]} tree`);
}

// ---- labs: find every L["id"] = registration ----
const labFiles = files.filter(f => /\/labs\d*\.js$/.test(f) || f.startsWith('web/labs/'));
const labs = {};
for (const f of labFiles) {
  const src = fs.readFileSync(path.join(R, f), 'utf8');
  for (const m of src.matchAll(/^\s*(?:L|LABS|window\.LABS)\[\s*["']([a-z0-9-]+)["']\s*\]\s*=/gm)) {
    if (labs[m[1]]) err(f, `lab "${m[1]}" registered twice (also in ${labs[m[1]]})`);
    labs[m[1]] = f;
  }
}

// ---- trees ----
const node = {};            // id -> {field, ...node}
for (const [field, tree] of Object.entries(DB.trees)) {
  const W = `tree ${field}`;
  if (!Array.isArray(tree.eras) || !Array.isArray(tree.nodes)) { err(W, 'needs eras[] and nodes[]'); continue; }
  const cells = {};
  for (const n of tree.nodes) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(n.id || '')) err(W, `bad id "${n.id}"`);
    if (node[n.id]) err(W, `id "${n.id}" also used in ${node[n.id].field}`);
    node[n.id] = { field, ...n };
    const cell = `${n.col},${n.row}`;
    if (cells[cell]) err(W, `"${n.id}" and "${cells[cell]}" share col/row ${cell}`);
    cells[cell] = n.id;
    if (!Number.isInteger(n.col) || !Number.isInteger(n.row)) err(W, `"${n.id}" col/row must be integers`);
    if (!n.icon) err(W, `"${n.id}" has no icon`);
    if (!Array.isArray(n.chips)) err(W, `"${n.id}" chips must be an array`);
    if (!Array.isArray(n.pre)) err(W, `"${n.id}" pre must be an array`);
    if (!tree.eras.some(e => n.col >= e.from && n.col <= e.to)) err(W, `"${n.id}" col ${n.col} is outside every era`);
  }
}
for (const n of Object.values(node)) {
  const W = `tree ${n.field} / ${n.id}`;
  for (const p of n.pre || []) {
    const q = node[p];
    if (!q) { err(W, `prerequisite "${p}" does not exist`); continue; }
    if (q.field === n.field && q.col >= n.col) err(W, `prerequisite "${p}" is not to its left (col ${q.col} ≥ ${n.col})`);
  }
  if (new Set(n.pre).size !== (n.pre || []).length) err(W, 'duplicate prerequisite');
}
// planned nodes (shown dashed until written): unique ids, prereqs inside the tree, to the left
for (const [field, tree] of Object.entries(DB.trees)) {
  const W = `tree ${field} (planned)`, pl = tree.planned || [], cells = new Set(tree.nodes.map(n => `${n.col},${n.row}`));
  const here = Object.fromEntries([...tree.nodes, ...pl].map(n => [n.id, n]));
  for (const n of pl) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(n.id || '')) err(W, `bad id "${n.id}"`);
    if (node[n.id]) err(W, `"${n.id}" is planned but already a written node`);
    if (!n.label || !n.icon || !Array.isArray(n.chips) || !Array.isArray(n.pre)) err(W, `"${n.id}" needs label, icon, chips[] and pre[]`);
    const cell = `${n.col},${n.row}`; if (cells.has(cell)) err(W, `"${n.id}" shares col/row ${cell}`); cells.add(cell);
    if (!tree.eras.some(e => n.col >= e.from && n.col <= e.to)) err(W, `"${n.id}" col ${n.col} is outside every era`);
    for (const p of n.pre || []) { if (!here[p]) { if (!node[p]) err(W, `"${n.id}" prerequisite "${p}" is neither in this tree nor a written topic of another field`); } else if (here[p].col >= n.col) err(W, `"${n.id}" prerequisite "${p}" is not to its left`); }
  }
  for (const n of tree.nodes) for (const p of n.pre || []) if (pl.some(x => x.id === p)) err(`tree ${field} / ${n.id}`, `written node depends on planned node "${p}"`);
}
// cycle check
const state = {};
const visit = (id, trail) => {
  if (state[id] === 2) return; if (state[id] === 1) { err('trees', 'prerequisite cycle: ' + [...trail, id].join(' → ')); return; }
  state[id] = 1; for (const p of (node[id] && node[id].pre) || []) if (node[p]) visit(p, [...trail, id]); state[id] = 2;
};
Object.keys(node).forEach(id => visit(id, []));

// ---- field map ----
for (const [id, f] of Object.entries(DB.fields || {})) {
  const W = `field ${id}`;
  for (const p of f.pre || []) if (!DB.fields[p]) err(W, `prerequisite field "${p}" does not exist`);
  if (f.status === 'charted' && !DB.trees[id]) err(W, 'status is "charted" but DB.trees has no tree');
  if (f.status !== 'charted' && DB.trees[id]) err(W, 'has a tree but status is not "charted"');
}
for (const id of Object.keys(DB.trees)) if (!(DB.fields || {})[id]) err(`tree ${id}`, 'no matching DB.fields entry');
for (const g of DB.fieldGroups || []) for (const id of g.ids) if (!DB.fields[id]) err(`fieldGroup ${g.name}`, `unknown field "${id}"`);
// subjects: every field in exactly one subject map group, prereqs inside the same subject
const SMs = DB.subjectMaps || {};
for (const [sub, sm] of Object.entries(SMs)) {
  for (const g of sm.groups || []) for (const id of g.ids) {
    if (!DB.fields[id]) err(`subject ${sub} / ${g.name}`, `unknown field "${id}"`);
    else if ((DB.fields[id].subject || 'mathematics') !== sub) err(`subject ${sub} / ${g.name}`, `"${id}" belongs to ${DB.fields[id].subject}`);
  }
}
for (const [id, f] of Object.entries(DB.fields || {})) {
  const sub = f.subject || 'mathematics';
  if (!SMs[sub]) { err(`field ${id}`, `unknown subject "${sub}"`); continue; }
  if (!(SMs[sub].groups || []).some(g => g.ids.includes(id))) err(`field ${id}`, `not in any ${sub} group`);
  for (const p of f.pre || []) if (DB.fields[p] && (DB.fields[p].subject || 'mathematics') !== sub) err(`field ${id}`, `prerequisite "${p}" is in another subject (use math: for mathematics)`);
  for (const m of f.math || []) if (!DB.fields[m] || (DB.fields[m].subject || 'mathematics') !== 'mathematics') err(`field ${id}`, `math field "${m}" does not exist`);
  for (const m of f.physics || []) if (!DB.fields[m] || DB.fields[m].subject !== 'physics') err(`field ${id}`, `physics field "${m}" does not exist`);
}
// node.math: a charted math topic id, or "field:Topic name" copied from that field's topics list
// node.physics: the same, for physics (used by subjects such as Music Theory that build on physics)
const refOk = sub => m => { const i = m.indexOf(':'); if (i < 0) return !!node[m] && (DB.fields[node[m].field].subject || 'mathematics') === sub;
  const f = DB.fields[m.slice(0, i)]; return !!f && (f.subject || 'mathematics') === sub && (f.topics || []).includes(m.slice(i + 1)); };
for (const n of Object.values(node)) for (const sub of ['mathematics', 'physics']) for (const m of n[sub === 'mathematics' ? 'math' : 'physics'] || []) if (!refOk(sub)(m)) err(`tree ${n.field} / ${n.id}`, `${sub === 'mathematics' ? 'math' : 'physics'} "${m}" is not a charted ${sub} topic or a field:Topic from a planned field's topics list`);

// ---- topic dossiers ----
const RAW = ['hero', 'lede', 'plain', 'formal', 'why', 'origin'];  // rendered as HTML
const VOID = new Set(['br', 'hr', 'img', 'wbr']);
function checkHtml(W, key, s) {
  if (typeof s !== 'string') return;
  const stack = [];
  for (const m of s.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g)) {
    const [, close, tag0, self] = m, tag = tag0.toLowerCase();
    if (VOID.has(tag) || self) continue;
    if (!close) stack.push(tag);
    else if (stack[stack.length - 1] === tag) stack.pop();
    else { err(W, `${key}: </${tag}> does not match <${stack[stack.length - 1] || 'nothing'}>`); return; }
  }
  if (stack.length) err(W, `${key}: unclosed <${stack.join('>, <')}>`);
  if (/<[a-z]+[^>]*$/i.test(s)) err(W, `${key}: tag cut off at the end`);
  const cls = [...s.matchAll(/class="([^"]*)"/g)].flatMap(m => m[1].split(/\s+/)).filter(c => /^c\d+$/.test(c) && !/^c[1-5]$/.test(c));
  if (cls.length) err(W, `${key}: colour class ${cls[0]} (only c1–c5 exist)`);
}
function checkText(W, key, s) {         // shown escaped, so markup would appear literally
  if (typeof s !== 'string' || !s.trim()) { err(W, `${key}: must be non-empty text`); return; }
  if (/<\/?[a-z][^>]*>/i.test(s)) err(W, `${key}: contains HTML, but this field is escaped text`);
}
const nonEmpty = (W, key, v) => { if (typeof v !== 'string' || !v.trim()) err(W, `${key} is missing or empty`); };
const arr = (W, key, v, min) => { if (!Array.isArray(v)) { err(W, `${key} must be an array`); return false; } if (v.length < min) err(W, `${key} has ${v.length} item(s), expected at least ${min}`); return true; };
// ("undefined" is not flagged: it is a real math word, as in "the slope is undefined")
const JUNK = /\b(TODO|TBD|FIXME|XXX|lorem ipsum)\b|\[object Object\]|\$\{/;

for (const [id, t] of Object.entries(T)) {
  const W = `topic ${id}`;
  const n = node[id];
  if (!n) { err(W, 'has content but is not in any tree'); continue; }
  for (const k of ['title', 'short', 'grade', 'eyebrow', 'hero', 'lede', 'plain', 'formal', 'why']) nonEmpty(W, k, t[k]);
  if (!(typeof t.hours === 'number' && t.hours > 0)) err(W, 'hours must be a positive number');
  if (!['young', 'mixed', 'plain'].includes(t.voice)) err(W, `voice "${t.voice}" must be young, mixed or plain`);
  for (const k of RAW) checkHtml(W, k, t[k]);
  // origin is optional: the brief says to omit it when the history is uncertain

  if (arr(W, 'legend', t.legend, 1)) t.legend.forEach((k, i) => {
    if (!/^c[1-5]$/.test(k.c)) err(W, `legend[${i}].c "${k.c}" must be c1–c5`);
    nonEmpty(W, `legend[${i}].sym`, k.sym); nonEmpty(W, `legend[${i}].name`, k.name); nonEmpty(W, `legend[${i}].desc`, k.desc);
    checkHtml(W, `legend[${i}].sym`, k.sym); checkHtml(W, `legend[${i}].desc`, k.desc);
  });
  if (!t.steps || typeof t.steps !== 'object') err(W, 'steps must be {title, items}');
  else { nonEmpty(W, 'steps.title', t.steps.title); if (arr(W, 'steps.items', t.steps.items, 2)) t.steps.items.forEach((s, i) => { nonEmpty(W, `steps.items[${i}]`, s); checkHtml(W, `steps.items[${i}]`, s); }); }
  const ex = t.example;
  if (!ex || typeof ex !== 'object') err(W, 'example must be {prompt, lines, answer}');
  else {
    nonEmpty(W, 'example.prompt', ex.prompt);
    if (arr(W, 'example.lines', ex.lines, 1)) ex.lines.forEach((l, i) => { nonEmpty(W, `example.lines[${i}].math`, l.math); if (l.note !== undefined && typeof l.note !== 'string') err(W, `example.lines[${i}].note must be text`); });
    if (ex.answer !== undefined) nonEmpty(W, 'example.answer', ex.answer);
  }
  if (arr(W, 'careers', t.careers, 3)) t.careers.forEach((c, i) => { checkText(W, `careers[${i}].role`, c.role); checkText(W, `careers[${i}].use`, c.use); });
  if (arr(W, 'life', t.life, 3)) t.life.forEach((s, i) => checkText(W, `life[${i}]`, s));
  if (arr(W, 'fields', t.fields, 2)) t.fields.forEach((f, i) => { checkText(W, `fields[${i}].name`, f.name); checkText(W, `fields[${i}].use`, f.use); });
  if (arr(W, 'beyond', t.beyond, 1)) t.beyond.forEach((b, i) => { checkText(W, `beyond[${i}].field`, b.field); checkText(W, `beyond[${i}].why`, b.why); });
  if (arr(W, 'mistakes', t.mistakes, 2)) t.mistakes.forEach((m, i) => { nonEmpty(W, `mistakes[${i}].wrong`, m.wrong); nonEmpty(W, `mistakes[${i}].fix`, m.fix); });
  if (arr(W, 'practice', t.practice, 3)) t.practice.forEach((p, i) => { nonEmpty(W, `practice[${i}].q`, p.q); nonEmpty(W, `practice[${i}].a`, p.a); checkHtml(W, `practice[${i}].a`, p.a); });

  // three-layer lessons (docs/subjects/LAYERS.md): t.layers = {concept, build, formal}
  if (t.layers !== undefined) {
    const Y = t.layers || {}, C = Y.concept, B = Y.build, F = Y.formal, LW = W + ' layers';
    if (!C || !B || !F) err(LW, 'needs concept, build and formal');
    if (Y.nudge !== undefined) checkText(LW, 'nudge', Y.nudge);   // the lesson's first "Not yet" in every checker
    for (const [k, o] of Object.entries({ concept: C, build: B, formal: F })) if (o && o.lede !== undefined) { nonEmpty(LW, `${k}.lede`, o.lede); checkHtml(LW, `${k}.lede`, o.lede); }
    if (C) {
      nonEmpty(LW, 'concept.lede', C.lede); nonEmpty(LW, 'concept.history', C.history); checkHtml(LW, 'concept.history', C.history);
      for (const k of ['what', 'why']) if (C[k] !== undefined) { nonEmpty(LW, `concept.${k}`, C[k]); checkHtml(LW, `concept.${k}`, C[k]); }  // optional: plain / why are used otherwise
      if (C.heading !== undefined) checkText(LW, 'concept.heading', C.heading);
      if (arr(LW, 'concept.sources', C.sources, 1)) C.sources.forEach((x, i) => { checkText(LW, `concept.sources[${i}].title`, x.title); if (!/^https:\/\//.test(x.url || '')) err(LW, `concept.sources[${i}].url must be https`); });
      if (arr(LW, 'concept.examples', C.examples, 3)) C.examples.forEach((x, i) => { checkText(LW, `concept.examples[${i}].role`, x.role); nonEmpty(LW, `concept.examples[${i}].scene`, x.scene); checkHtml(LW, `concept.examples[${i}].scene`, x.scene); if (x.takeaway !== undefined) checkText(LW, `concept.examples[${i}].takeaway`, x.takeaway); });
    }
    // Concept blocks (conceptHTML in app.js; docs/subjects/LAYERS.md → "Concept blocks"): opt in with concept.ideas
    if (C && C.ideas !== undefined) {
      const LABRE = /^[a-z]+(:[-\d.]+)?(,[a-z]+(:[-\d.]+)?)*$/;
      const tryOk = (P, x) => { if (!x || typeof x !== 'object') { err(LW, `${P} must be {label, lab}`); return; } checkText(LW, `${P}.label`, x.label); if (!LABRE.test(x.lab || '')) err(LW, `${P}.lab must look like "set:19,play" (commands the lab exposes)`); };
      const demoOk = (P, d) => { DEMO.check(d).forEach(m => err(LW, `${P}: ${m}`)); if (d && d.kind === 'dots' && d.grow === undefined && d.frames === undefined && (!Number.isInteger(d.lit) || d.lit < 1 || d.lit > d.slots)) err(LW, `${P}.lit must be 1 to slots`); };
      if (!C.question || typeof C.question !== 'object') err(LW, 'concept.question must be {text, sub, figure}'); else { checkText(LW, 'concept.question.text', C.question.text); if (C.question.sub !== undefined) { nonEmpty(LW, 'concept.question.sub', C.question.sub); checkHtml(LW, 'concept.question.sub', C.question.sub); } }
      if (arr(LW, 'concept.ideas', C.ideas, 2)) { if (C.ideas.length > 4) err(LW, 'concept.ideas has more than 4 cards');
        C.ideas.forEach((x, i) => { const P = `concept.ideas[${i}]`; checkText(LW, `${P}.title`, x.title); nonEmpty(LW, `${P}.text`, x.text); checkHtml(LW, `${P}.text`, x.text);
          if (x.term !== undefined) checkText(LW, `${P}.term`, x.term); if (x.c !== undefined && !/^c[1-5]$/.test(x.c)) err(LW, `${P}.c must be c1 to c5`);
          if (x.demo !== undefined) demoOk(`${P}.demo`, x.demo); if (x.try !== undefined) tryOk(`${P}.try`, x.try); }); }
      if (C.timelineTitle !== undefined) checkText(LW, 'concept.timelineTitle', C.timelineTitle);
      if (C.timelineLead !== undefined) { nonEmpty(LW, 'concept.timelineLead', C.timelineLead); checkHtml(LW, 'concept.timelineLead', C.timelineLead); }
      if (C.matters !== undefined) { const M = C.matters || {}; checkText(LW, 'concept.matters.title', M.title); nonEmpty(LW, 'concept.matters.text', M.text); checkHtml(LW, 'concept.matters.text', M.text); }
      if (C.question && C.question.figure && C.question.figure.echo !== undefined && !/^[A-Za-z_]\w*$/.test(C.question.figure.echo)) err(LW, 'concept.question.figure.echo must be a lab value name (k.publish key)');
      if (C.stakes !== undefined) { const S = C.stakes || {}; checkText(LW, 'concept.stakes.title', S.title); nonEmpty(LW, 'concept.stakes.lead', S.lead); checkHtml(LW, 'concept.stakes.lead', S.lead);
        if (arr(LW, 'concept.stakes.items', S.items, 2)) S.items.forEach((x, i) => { checkText(LW, `concept.stakes.items[${i}].role`, x.role); nonEmpty(LW, `concept.stakes.items[${i}].text`, x.text); checkHtml(LW, `concept.stakes.items[${i}].text`, x.text); });
        if (S.try !== undefined) tryOk('concept.stakes.try', S.try); }
      if (arr(LW, 'concept.timeline', C.timeline, 3)) { if (C.timeline.length > 5) err(LW, 'concept.timeline has more than 5 beats'); C.timeline.forEach((x, i) => { checkText(LW, `concept.timeline[${i}].when`, x.when); nonEmpty(LW, `concept.timeline[${i}].what`, x.what); checkHtml(LW, `concept.timeline[${i}].what`, x.what); }); }
      if (C.walk !== undefined) { const K = C.walk || {}; nonEmpty(LW, 'concept.walk.prompt', K.prompt); checkHtml(LW, 'concept.walk.prompt', K.prompt); nonEmpty(LW, 'concept.walk.answer', K.answer); checkHtml(LW, 'concept.walk.answer', K.answer);
        if (arr(LW, 'concept.walk.lines', K.lines, 2)) K.lines.forEach((l, i) => { nonEmpty(LW, `concept.walk.lines[${i}].math`, l.math); checkHtml(LW, `concept.walk.lines[${i}].math`, l.math); if (l.note !== undefined) checkHtml(LW, `concept.walk.lines[${i}].note`, l.note); if (l.frame !== undefined && !Number.isInteger(l.frame)) err(LW, `concept.walk.lines[${i}].frame must be a frame number`); });
        if (K.predict !== undefined && (!Array.isArray(K.predict) || K.predict.length > (K.lines || []).length)) err(LW, 'concept.walk.predict must have at most one item per line');
        if (K.demo !== undefined) { demoOk('concept.walk.demo', K.demo); if (!DEMO.check(K.demo).length) { const nf = demoFrames(K.demo); (K.lines || []).forEach((l, i) => { if (l.frame !== undefined && (!Number.isInteger(l.frame) || l.frame < 0 || l.frame >= nf)) err(LW, `concept.walk.lines[${i}].frame must be 0 to ${nf - 1} (the picture has ${nf} frames)`); }); } }
        if (K.title !== undefined) checkText(LW, 'concept.walk.title', K.title); }
      (C.examples || []).forEach((x, i) => { if (x.figure !== undefined) checkText(LW, `concept.examples[${i}].figure`, x.figure); else err(LW, `concept.examples[${i}].figure is missing (the tile's headline number)`); if (x.try !== undefined) tryOk(`concept.examples[${i}].try`, x.try); });
    }
    for (const [k, o] of [['concept', C], ['build', B]]) if (o && o.objects !== undefined && (!Array.isArray(o.objects) || o.objects.some(w => typeof w !== 'string' || !/^[A-Za-z][A-Za-z' -]*$/.test(w)))) err(LW, `${k}.objects must be a list of words (the things counted, as written on the page)`);
    if (B) {
      nonEmpty(LW, 'build.lede', B.lede);
      for (const k of ['intro', 'bridge']) { nonEmpty(LW, `build.${k}`, B[k]); checkHtml(LW, `build.${k}`, B[k]); }
      if (arr(LW, 'build.stepWhy', B.stepWhy, 1)) { if (t.steps && t.steps.items && B.stepWhy.length !== t.steps.items.length) err(LW, `build.stepWhy has ${B.stepWhy.length} items but steps.items has ${t.steps.items.length}`); B.stepWhy.forEach((x, i) => { nonEmpty(LW, `build.stepWhy[${i}]`, x); checkHtml(LW, `build.stepWhy[${i}]`, x); }); }
      if (arr(LW, 'build.tasks', B.tasks, 3)) B.tasks.forEach((x, i) => { checkText(LW, `build.tasks[${i}].task`, x.task); nonEmpty(LW, `build.tasks[${i}].link`, x.link); checkHtml(LW, `build.tasks[${i}].link`, x.link); });
      // Intermediate blocks (buildHTML in app.js; docs/subjects/LAYERS.md → "Intermediate blocks"): opt in with build.task
      if (B.task !== undefined) {
        const LABRE = /^[a-z]+(:[-\d.]+)?(,[a-z]+(:[-\d.]+)?)*$/, JUMPS = ['b-method', 'b-example', 'b-tasks'];
        const tryOk = (P, x) => { if (x === null) return; if (!x || typeof x !== 'object') { err(LW, `${P} must be {label, lab} or null`); return; } checkText(LW, `${P}.label`, x.label); if (!LABRE.test(x.lab || '')) err(LW, `${P}.lab must look like "set:19,play" (commands the lab exposes)`); };
        const T = B.task || {}; checkText(LW, 'build.task.text', T.text); if (T.sub !== undefined) { nonEmpty(LW, 'build.task.sub', T.sub); checkHtml(LW, 'build.task.sub', T.sub); }
        if (T.figure && T.figure.echo !== undefined && !/^[A-Za-z_]\w*$/.test(T.figure.echo)) err(LW, 'build.task.figure.echo must be a lab value name (k.publish key)');
        (T.jump || []).forEach((j, i) => { checkText(LW, `build.task.jump[${i}].label`, j.label); if (!JUMPS.includes(j.to)) err(LW, `build.task.jump[${i}].to must be one of ${JUMPS.join(', ')}`); });
        for (const [k, n] of [['keyTry', (t.legend || []).length], ['stepTry', ((t.steps || {}).items || []).length]]) if (B[k] !== undefined) { if (!Array.isArray(B[k]) || B[k].length > n) err(LW, `build.${k} must be an array of at most ${n} items (one per ${k === 'keyTry' ? 'legend key' : 'step'}, null for none)`); else B[k].forEach((x, i) => tryOk(`build.${k}[${i}]`, x)); }
        if (B.matters !== undefined) { const M = B.matters || {}; checkText(LW, 'build.matters.title', M.title); nonEmpty(LW, 'build.matters.text', M.text); checkHtml(LW, 'build.matters.text', M.text); }
        if (B.exampleTip !== undefined) { nonEmpty(LW, 'build.exampleTip', B.exampleTip); checkHtml(LW, 'build.exampleTip', B.exampleTip); }
        if (B.exampleTry !== undefined) tryOk('build.exampleTry', B.exampleTry);
        (B.tasks || []).forEach((x, i) => { if (x.figure !== undefined) checkText(LW, `build.tasks[${i}].figure`, x.figure); if (x.try !== undefined) tryOk(`build.tasks[${i}].try`, x.try);  if (x.demo !== undefined) DEMO.check(x.demo).forEach(m => err(LW, `build.tasks[${i}].demo: ${m}`)); });
        if (B.exampleTask && B.exampleTask.demo !== undefined) DEMO.check(B.exampleTask.demo).forEach(m => err(LW, `build.exampleTask.demo: ${m}`));
        const chk = (P, k) => { if (!k || typeof k !== 'object') { err(LW, `${P} must be an object`); return; } if (k.hint !== undefined) { nonEmpty(LW, `${P}.hint`, k.hint); checkHtml(LW, `${P}.hint`, k.hint); }
          if (k.choices !== undefined) { if (arr(LW, `${P}.choices`, k.choices, 2)) { if (k.choices.filter(c => c.ok).length !== 1) err(LW, `${P}.choices needs exactly one ok: true`); k.choices.forEach((c, j) => { nonEmpty(LW, `${P}.choices[${j}].t`, c.t); checkHtml(LW, `${P}.choices[${j}].t`, c.t); if (!c.ok && c.why === undefined) err(LW, `${P}.choices[${j}] needs a why (shown when it is picked)`); }); } }
          else if (arr(LW, `${P}.parts`, k.parts, 1)) k.parts.forEach((x, j) => { checkText(LW, `${P}.parts[${j}].label`, x.label); if (typeof x.ans !== 'number' || !isFinite(x.ans)) err(LW, `${P}.parts[${j}].ans must be a number (add it to the check file too)`); }); };
        if (B.predict !== undefined) { if (!Array.isArray(B.predict) || B.predict.length > ((t.example || {}).lines || []).length) err(LW, 'build.predict must have at most one item per example line');
          else { if (B.predict[0]) err(LW, 'build.predict[0] must be null: the first line is shown with the problem'); B.predict.forEach((q, i) => { if (q === null) return; nonEmpty(LW, `build.predict[${i}].ask`, q.ask); checkHtml(LW, `build.predict[${i}].ask`, q.ask); chk(`build.predict[${i}]`, q); }); } }
        if (B.stepGoal !== undefined) { if (!Array.isArray(B.stepGoal) || B.stepGoal.length > ((t.steps || {}).items || []).length) err(LW, 'build.stepGoal must have at most one item per step');
          else B.stepGoal.forEach((g, i) => { if (g === null) return; const P = `build.stepGoal[${i}]`; if (!/^[A-Za-z_]\w*$/.test(g.key || '')) err(LW, `${P}.key must be a value the lab publishes (k.publish)`); if (g.eq === undefined && g.min === undefined) err(LW, `${P} needs eq or min`); for (const k of ['eq', 'min']) if (g[k] !== undefined && typeof g[k] !== 'number') err(LW, `${P}.${k} must be a number`); nonEmpty(LW, `${P}.text`, g.text); checkHtml(LW, `${P}.text`, g.text); if (g.after !== undefined) checkHtml(LW, `${P}.after`, g.after); if ((B.stepTry || [])[i]) err(LW, `${P}: drop stepTry[${i}] (a chip would do the move for the learner)`); }); }
        (B.tasks || []).forEach((x, i) => { if (x.check !== undefined) { nonEmpty(LW, `build.tasks[${i}].check.q`, (x.check || {}).q); checkHtml(LW, `build.tasks[${i}].check.q`, (x.check || {}).q); chk(`build.tasks[${i}].check`, x.check); } });
        for (const k of ['goalsIntro']) if (B[k] !== undefined) { nonEmpty(LW, `build.${k}`, B[k]); checkHtml(LW, `build.${k}`, B[k]); }
      }
    }
    if (F && F.question !== undefined) {   // Formal blocks (formalHTML in app.js; docs/subjects/LAYERS.md → "Formal blocks")
      const Q = F.question || {}, JUMPS = ['f-vocab', 'f-setup', 'f-mist', 'f-prac'];
      checkText(LW, 'formal.question.text', Q.text); if (Q.sub !== undefined) { nonEmpty(LW, 'formal.question.sub', Q.sub); checkHtml(LW, 'formal.question.sub', Q.sub); }
      if (Q.figure && Q.figure.echo !== undefined && !/^[A-Za-z_]\w*$/.test(Q.figure.echo)) err(LW, 'formal.question.figure.echo must be a lab value name (k.publish key)');
      (Q.jump || []).forEach((j, i) => { checkText(LW, `formal.question.jump[${i}].label`, j.label); if (!JUMPS.includes(j.to)) err(LW, `formal.question.jump[${i}].to must be one of ${JUMPS.join(', ')}`); });
      if (arr(LW, 'formal.vocab', F.vocab, 3)) { if (F.vocab.length > 8) err(LW, 'formal.vocab has more than 8 cards');
        F.vocab.forEach((v, i) => { const P = `formal.vocab[${i}]`; checkText(LW, `${P}.term`, v.term); for (const k of ['sym', 'def']) { nonEmpty(LW, `${P}.${k}`, v[k]); checkHtml(LW, `${P}.${k}`, v[k]); } if (v.was !== undefined) checkText(LW, `${P}.was`, v.was); if (v.c !== undefined && !/^c[1-5]$/.test(v.c)) err(LW, `${P}.c must be c1 to c5`); }); }
      if (F.matters !== undefined) { const M = F.matters || {}; checkText(LW, 'formal.matters.title', M.title); nonEmpty(LW, 'formal.matters.text', M.text); checkHtml(LW, 'formal.matters.text', M.text); }
      if (F.checks !== undefined) { if (!Array.isArray(F.checks) || F.checks.length > (t.practice || []).length) err(LW, 'formal.checks must be an array, at most one per practice item');
        else F.checks.forEach((k, i) => { const P = `formal.checks[${i}]`; if (k === null) return; if (k.hint !== undefined) { nonEmpty(LW, `${P}.hint`, k.hint); checkHtml(LW, `${P}.hint`, k.hint); }
          if (arr(LW, `${P}.parts`, k.parts, 1)) k.parts.forEach((x, j) => { checkText(LW, `${P}.parts[${j}].label`, x.label); if (typeof x.ans !== 'number' || !isFinite(x.ans)) err(LW, `${P}.parts[${j}].ans must be a number`);
            else { const a = String((t.practice[i] || {}).a || '').replace(/<[^>]+>/g, '').replace(/(\d),(?=\d{3})/g, '$1').replace(/\u2212/g, '-'); if (!new RegExp(`(^|[^\\d.])${String(x.ans).replace('.', '\\.')}(?![\\d])`).test(a)) err(LW, `${P}.parts[${j}].ans ${x.ans} does not appear in practice[${i}].a (the checked answer)`); } }); }); }
      for (const k of ['vocabIntro', 'setupIntro', 'mistakesLead', 'practiceTip', 'practiceDone']) if (F[k] !== undefined) { nonEmpty(LW, `formal.${k}`, F[k]); checkHtml(LW, `formal.${k}`, F[k]); }
      for (const k of ['vocabTitle', 'mistakesTitle', 'statementTitle', 'eyebrow', 'practiceTitle']) if (F[k] !== undefined) checkText(LW, `formal.${k}`, F[k]);
    }
    if (F) {
      if (!F.setup || typeof F.setup !== 'object') err(LW, 'formal.setup must be {title, items}');
      else { checkText(LW, 'formal.setup.title', F.setup.title); if (arr(LW, 'formal.setup.items', F.setup.items, 3)) F.setup.items.forEach((x, i) => { nonEmpty(LW, `formal.setup.items[${i}].say`, x.say); checkHtml(LW, `formal.setup.items[${i}].say`, x.say); if (x.math !== undefined) { nonEmpty(LW, `formal.setup.items[${i}].math`, x.math); checkHtml(LW, `formal.setup.items[${i}].math`, x.math); } }); }
    }
    t.practice && t.practice.forEach((p, i) => { if (p.ctx !== undefined) checkText(LW, `practice[${i}].ctx`, p.ctx); });
    if (JUNK.test(JSON.stringify(t.layers))) err(LW, 'contains placeholder text');
  }

  // prereqWhy / unlocksWhy must match the tree edges
  const pw = t.prereqWhy || {}, uw = t.unlocksWhy || {};
  const unlocks = Object.values(node).filter(m => (m.pre || []).includes(id)).map(m => m.id);
  for (const k of Object.keys(pw)) if (!n.pre.includes(k)) err(W, `prereqWhy["${k}"] but "${k}" is not a prerequisite`);
  // unlocksWhy may already name planned nodes that list this topic (written ahead, shown once the node is written)
  const plannedUnlocks = Object.values(DB.trees).flatMap(tr => tr.planned || []).filter(m => (m.pre || []).includes(id)).map(m => m.id);
  for (const k of Object.keys(uw)) if (!unlocks.includes(k) && !plannedUnlocks.includes(k)) err(W, `unlocksWhy["${k}"] but "${k}" does not list this topic as a prerequisite`);
  for (const k of n.pre) if (!pw[k]) warn(W, `no prereqWhy for "${k}"`);
  for (const k of unlocks) if (!uw[k]) warn(W, `no unlocksWhy for "${k}"`);
  for (const [k, v] of Object.entries({ ...pw, ...uw })) checkHtml(W, `why["${k}"]`, v);
  const mw = t.mathWhy || {};
  for (const k of Object.keys(mw)) if (![...(n.math || []), ...(n.physics || [])].includes(k)) err(W, `mathWhy["${k}"] but it is not in the node's math or physics list`);
  for (const k of [...(n.math || []), ...(n.physics || [])]) if (!mw[k]) warn(W, `no mathWhy for "${k}"`);
  for (const [k, v] of Object.entries(mw)) checkHtml(W, `mathWhy["${k}"]`, v);

  // stories (English): passages built from tagged tokens, with original art from DB.scenes
  if (t.stories !== undefined && arr(W, 'stories', t.stories, 1)) t.stories.forEach((st, i) => {
    const S = `stories[${i}]`;
    for (const k of ['title', 'book', 'author', 'kind', 'where', 'tokens', 'note']) nonEmpty(W, `${S}.${k}`, st[k]);
    if (!Number.isInteger(st.year)) err(W, `${S}.year must be an integer`);
    else if (st.year > new Date().getFullYear() - 96) warn(W, `${S}: ${st.book} (${st.year}) may still be under copyright; quote only public-domain works`);
    if (!(DB.scenes || {})[st.scene]) err(W, `${S}.scene "${st.scene}" is not in DB.scenes (web/art/)`);
    checkHtml(W, `${S}.note`, st.note);
    // tags: parts of speech by default (every word tagged), or the story's own tag set (untagged words allowed)
    const own = st.tags !== undefined, TG = own ? st.tags : DB.posTags;
    if (own) { if (!TG || typeof TG !== 'object' || !Object.keys(TG).length) err(W, `${S}.tags must be {tag: {name, c}}`);
      else for (const [k, v] of Object.entries(TG)) { if (!/^[a-z]+$/.test(k)) err(W, `${S}.tags key "${k}" must be lower-case letters`); if (!v || !v.name || !/^c[1-5]$/.test(v.c)) err(W, `${S}.tags["${k}"] needs name and c (c1–c5)`); if (v && v.test !== undefined) checkText(W, `${S}.tags["${k}"].test`, v.test); } }
    if (!Array.isArray(st.focus) || !st.focus.length || st.focus.some(f => !(TG || {})[f])) err(W, `${S}.focus must list tags from ${own ? 'its tags' : 'DB.posTags'}`);
    const toks = DB.parseStory(st.tokens), keys = new Set(toks.filter(x => x.tag).map(x => x.key));
    toks.forEach(x => { if (x.tag && !(TG || {})[x.tag]) err(W, `${S}: unknown tag "_${x.tag}" on "${x.w}"`); if (!own && !x.tag && !x.br && /[A-Za-z0-9]/.test(x.w)) err(W, `${S}: word "${x.w}" has no _tag`); });
    if (st.focus && !st.focus.some(f => toks.some(x => x.tag === f))) err(W, `${S}: no word has a focus tag`);
    for (const k of Object.keys(st.notes || {})) { if (!keys.has(k)) err(W, `${S}.notes["${k}"] matches no word`); checkText(W, `${S}.notes["${k}"]`, st.notes[k]); }
  });

  const flat = JSON.stringify(t);
  const j = flat.match(JUNK); if (j) err(W, `contains placeholder text "${j[0]}"`);
}
for (const id of Object.keys(node)) {
  if (!T[id]) err(`tree ${node[id].field} / ${id}`, 'no topic dossier (would show the "coming soon" stub)');
  if (!labs[id]) err(`tree ${node[id].field} / ${id}`, 'no interactive lab');
}
for (const [id, f] of Object.entries(labs)) if (!node[id]) err(f, `lab "${id}" is not in any tree`);

// ---- glossary (web/glossary/<subject>.js, spec web/GLOSSARY-SPEC.md) ----
{
  const G = DB.glossary || [], subjOf = f => (DB.fields[f] && DB.fields[f].subject) || 'mathematics';
  const planned = {}; for (const [f, tr] of Object.entries(DB.trees)) for (const n of tr.planned || []) planned[n.id] = f;
  const ipaOk = new Set([...(DB.ipaKey || '').replace(/\s/g, ''), '/', 'ˈ', 'ˌ', '.', ' ']);
  const GOK = new Set(['i', 'b', 'sub', 'sup', 'code']);
  const gHtml = (W, key, s) => { if (typeof s !== 'string' || !s.trim()) { err(W, `${key}: must be non-empty`); return; } checkHtml(W, key, s);
    for (const m of s.matchAll(/<\/?([a-zA-Z0-9]+)/g)) if (!GOK.has(m[1].toLowerCase())) err(W, `${key}: <${m[1]}> not allowed (only i, b, sub, sup, code)`);
    const j = s.match(JUNK); if (j) err(W, `${key}: placeholder text "${j[0]}"`); };
  const words = new Set(G.map(e => e.w)), seen = {};
  const KEYS = new Set(['subject','w','field','node','pos','ipa','syl','senses','ex','quote','parts','origin','register','conno','syn','ant','confused','forms','see']);
  G.forEach((e, i) => {
    const W = `glossary ${e.subject}: "${e.w}"`;
    for (const k of Object.keys(e)) if (!KEYS.has(k)) err(W, `unknown key "${k}"`);
    if (!DB.subjects.some(s => s.id === e.subject)) err(W, `subject "${e.subject}" is not in DB.subjects`);
    if (typeof e.w !== 'string' || !/^[A-Za-z][A-Za-z' -]*$/.test(e.w)) err(W, 'w must be a plain word or phrase');
    const dup = `${e.subject}|${e.w}|${e.pos}`; if (seen[dup]) err(W, `listed twice for ${e.subject} with pos "${e.pos}"`); seen[dup] = 1;
    if (!DB.posTags[e.pos]) err(W, `pos "${e.pos}" is not a DB.posTags key`);
    if (e.field !== undefined) { if (!DB.fields[e.field]) err(W, `field "${e.field}" does not exist`); else if (subjOf(e.field) !== e.subject) err(W, `field "${e.field}" belongs to ${subjOf(e.field)}, not ${e.subject}`); }
    if (e.node !== undefined) { const f = node[e.node] ? node[e.node].field : planned[e.node];
      if (!f) err(W, `node "${e.node}" is not a written or planned node`); else if (e.field !== f) err(W, `node "${e.node}" is in field "${f}", so field must be "${f}"`); }
    if (typeof e.ipa !== 'string' || !/^\/[^/]+\/$/.test(e.ipa)) err(W, 'ipa must be /…/');
    else { const bad = [...e.ipa].filter(c => !ipaOk.has(c)); if (bad.length) err(W, `ipa has symbols outside DB.ipaKey: ${[...new Set(bad)].join(' ')}`); }
    if (e.syl !== undefined && (typeof e.syl !== 'string' || e.syl.replace(/·/g, '').toLowerCase() !== e.w.toLowerCase())) err(W, `syl "${e.syl}" must spell the headword with · between syllables`);
    if (!Array.isArray(e.senses) || !e.senses.length || e.senses.length > 4) err(W, 'senses must have 1–4 items'); else e.senses.forEach((s, k) => gHtml(W, `senses[${k}]`, s));
    if (e.ex !== undefined) gHtml(W, 'ex', e.ex);
    if (e.origin !== undefined) gHtml(W, 'origin', e.origin);
    if (e.register !== undefined && !(DB.glossaryRegister || {})[e.register]) err(W, `register "${e.register}" must be one of ${Object.keys(DB.glossaryRegister || {}).join(', ')}`);
    if (e.conno !== undefined && !['positive','neutral','negative'].includes(e.conno)) err(W, 'conno must be positive, neutral or negative');
    for (const k of ['parts', 'syn', 'confused']) if (e[k] !== undefined) { if (!Array.isArray(e[k]) || !e[k].every(p => Array.isArray(p) && p.length === 2)) err(W, `${k} must be [[word, gloss], …]`); else e[k].forEach((p, j) => { checkText(W, `${k}[${j}][0]`, p[0]); gHtml(W, `${k}[${j}][1]`, p[1]); }); }
    if (e.parts && Array.isArray(e.parts)) { const joined = e.parts.map(p => p[0]).join('').toLowerCase(); if (!/^[a-z]+$/.test(joined)) err(W, 'parts must be letters'); }
    for (const k of ['ant', 'forms', 'see']) if (e[k] !== undefined) { if (!Array.isArray(e[k])) err(W, `${k} must be an array`); else e[k].forEach((s, j) => checkText(W, `${k}[${j}]`, s)); }
    for (const s of e.see || []) if (!words.has(s)) err(W, `see "${s}" is not a glossary headword`);
    if (e.quote !== undefined) { const q = e.quote, t = q && T[q.topic];
      if (!t || !Array.isArray(t.stories)) err(W, `quote.topic "${q && q.topic}" is not a topic with stories`);
      else if (!t.stories.some(st => DB.storyText(st.tokens).includes(q.text))) err(W, `quote "${q.text}" is not in any story on ${q.topic}`);
      else if (!new RegExp('\\b' + e.w + '\\b', 'i').test(q.text) && !(e.forms || []).some(f => new RegExp('\\b' + f + '\\b', 'i').test(q.text))) err(W, 'quote does not contain the headword'); }
  });
  for (const g of DB.subjectGroups || []) if (!(DB.glossaryGroupColour || {})[g.id]) err('glossary', `subject group "${g.id}" has no colour in DB.glossaryGroupColour`);
  for (const f of files.filter(f => f.startsWith('web/glossary/'))) { const m = f.match(/^web\/glossary\/([a-z0-9-]+)\.js$/), src = fs.readFileSync(path.join(R, f), 'utf8');
    const subs = [...src.matchAll(/DB\.addGlossary\(\s*"([a-z0-9-]+)"/g)].map(x => x[1]); if (!m || subs.length !== 1 || subs[0] !== m[1]) err(f, `should call DB.addGlossary("${m ? m[1] : '?'}", …) once`); }
}

// ---- report ----
const fields = Object.keys(DB.trees).map(k => `${k} ${DB.trees[k].nodes.length}`).join(', ');
if (process.argv.includes('--warnings') || process.env.CI) warnings.forEach(w => console.log('warn  ' + w));
errors.forEach(e => console.log('ERROR ' + e));
console.log(`\n${Object.keys(node).length} topics (${fields}), ${Object.keys(labs).length} labs, ${(DB.glossary || []).length} glossary entries: ${errors.length} error(s), ${warnings.length} warning(s)` + (warnings.length && !process.argv.includes('--warnings') ? ' (--warnings to list)' : ''));
process.exit(errors.length ? 1 : 0);
