// One command for a writer's finish steps, with a short fixed-format report (instead of four long outputs).
//   node tools/finish.js <id…>            device or cloud: build → validate → labtest
//   node tools/finish.js --browser <id…>  cloud only: also layoutcheck <ids> and one contact sheet per id (sheet.js)
//   --lab=a2-3  (your lab file name) so build errors in it count as yours; failures that mention none of your ids/lab
//   are reported as ignored (other writers' work in progress in a shared folder)
//   SMOKE=1 adds smoke.js for just these ids (ONLY=…). Exit code 1 if any step fails.
// Report: one line per step (ok / FAIL + up to 12 relevant lines), then "FINISH ok" or "FINISH FAIL".
const { spawnSync } = require('child_process'), path = require('path');
const R = path.join(__dirname, '..'), args = process.argv.slice(2), browser = args.includes('--browser'), ids = args.filter(a => !a.startsWith('--')), labs = args.filter(a => a.startsWith('--lab=')).map(a => a.slice(6)), mineKeys = [...ids, ...labs];
if (!ids.length) { console.error('usage: node tools/finish.js [--browser] <topic-id…>'); process.exit(1); }
const run = (label, cmd, argv, env = {}, pick) => {
  const r = spawnSync(cmd, argv, { cwd: R, encoding: 'utf8', env: Object.assign({}, process.env, env), maxBuffer: 64 << 20 });
  const outText = (r.stdout || '') + (r.stderr || ''), lines = outText.split('\n').filter(Boolean);
  let good = r.status === 0, note = '';
  // several writers share the folder: a failure that never mentions your ids belongs to someone else's work in progress
  if (!good && pick && !lines.some(l => mineKeys.some(i => l.includes(i)))) { good = true; note = ` (ignored ${lines.filter(l => /error|FAIL|problem|SKIPPED/.test(l)).length} problem line(s) in other topics)`; }
  const shown = good ? [lines[lines.length - 1] || ''] : (pick ? lines.filter(pick) : lines).slice(0, 12);
  console.log(`${good ? 'ok  ' : 'FAIL'} ${label}${good ? ': ' + shown[0] + note : '\n     ' + shown.join('\n     ')}`);
  return good;
};
const mine = l => ids.some(i => l.includes(i)) || /error|Error|FAIL|problem/.test(l) && !/^\s*$/.test(l);
let all = true;
all = run('build', 'node', ['tools/build-web.js'], {}, l => /error|Error|SyntaxError|\.js/.test(l)) && all;
all = run('validate', 'node', ['tools/validate.js'], {}, mine) && all;
all = run('labtest', 'node', ['tools/labtest.js']) && all;
if (browser) {
  all = run('layoutcheck', 'node', ['tools/layoutcheck.js', ...ids], {}, l => !l.startsWith('ok ')) && all;
  if (process.env.SMOKE) all = run('smoke', 'node', ['tools/smoke.js'], { ONLY: ids.join(',') }) && all;
  all = run('sheet', 'node', ['tools/sheet.js', ...ids]) && all;
  console.log('     sheets: ' + ids.map(i => `/tmp/inqlaw-sheet/${i}.png`).join(' '));
}
console.log(all ? 'FINISH ok' : 'FINISH FAIL');
process.exit(all ? 0 : 1);
