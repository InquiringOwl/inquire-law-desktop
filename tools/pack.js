// Move work between the Mac folder and the cloud container with small archives instead of whole-repo copies.
// Works on either side (device shell or cloud). Archives go to .sync/ (git-ignored).
//   node tools/pack.js            full pack (no node_modules/.git/dist/.sync/.snap) → .sync/law.tgz, stamps .sync/.packed
//   node tools/pack.js --changed  only files modified since the last stamp → .sync/delta.tgz (prints the list), re-stamps
//   node tools/pack.js --since <file|ISO time>   same, against another reference time
//   node tools/pack.js --out name.tgz …         other archive name
// Unpack with tools/unpack.js (extracts to a temp dir, then copies over, so it works where files can't be deleted).
// Typical loop: device `pack.js` once → stage → cloud `bash tools/cloud.sh .sync/law.tgz` → later device `pack.js --changed`
// → stage → cloud `node tools/unpack.js <delta>`; results back: cloud `pack.js --changed` → commit to .sync/ → device `unpack.js`.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const R = path.join(__dirname, '..'), args = process.argv.slice(2);
const SKIP = new Set(['node_modules', '.git', 'dist', '.sync', '.snap', '__pycache__', '.DS_Store']);
const SKIP_FILES = new Set(['app/index.html', 'dist-web/inquire-law.html']);   // build outputs: rebuilt on the other side
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const stampFile = path.join(R, '.sync', '.packed');
let since = null;
if (args.includes('--changed')) since = fs.existsSync(stampFile) ? fs.statSync(stampFile).mtimeMs : 0;
if (opt('--since')) { const s = opt('--since'); since = fs.existsSync(s) ? fs.statSync(s).mtimeMs : Date.parse(s); }
const out = path.join(R, '.sync', opt('--out') || (since !== null ? 'delta.tgz' : 'inqlaw.tgz'));
const files = [];
(function walk(dir){
  for (const e of fs.readdirSync(path.join(R, dir), { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const rel = dir ? dir + '/' + e.name : e.name;
    if (e.isDirectory()) walk(rel);
    else if (e.isFile() && !SKIP_FILES.has(rel) && !rel.endsWith('.tgz') && (since === null || fs.statSync(path.join(R, rel)).mtimeMs > since)) files.push(rel);
  }
})('');
fs.mkdirSync(path.dirname(out), { recursive: true });
if (!files.length) { console.log('nothing changed since the last pack'); process.exit(0); }
const list = path.join(R, '.sync', '.filelist'); fs.writeFileSync(list, files.join('\n') + '\n');
execFileSync('tar', ['-czf', out, '-C', R, '-T', list]);
const now = new Date(); fs.writeFileSync(stampFile, now.toISOString()); fs.utimesSync(stampFile, now, now);
const kb = Math.round(fs.statSync(out).size / 1024);
console.log(`${path.relative(R, out)}: ${files.length} file(s), ${kb} KB`);
if (since !== null && files.length <= 40) console.log(files.map(f => '  ' + f).join('\n'));
