// Unpack an archive made by tools/pack.js over this folder: extracts to a temp dir, then copies file by file
// (so it works in the device shell, where existing files can't be deleted or replaced by tar).
//   node tools/unpack.js <archive.tgz> [--dry]   prints what changed (new / updated / same)
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const R = path.join(__dirname, '..'), [arc, ...rest] = process.argv.slice(2);
if (!arc) { console.error('usage: node tools/unpack.js <archive.tgz> [--dry]'); process.exit(1); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inqlaw-unpack-'));
execFileSync('tar', ['-xzf', path.resolve(arc), '-C', tmp]);
const res = { new: [], updated: [], same: 0 };
(function walk(dir){
  for (const e of fs.readdirSync(path.join(tmp, dir), { withFileTypes: true })) {
    const rel = dir ? dir + '/' + e.name : e.name;
    if (e.isDirectory()) { walk(rel); continue; }
    const src = path.join(tmp, rel), dst = path.join(R, rel);
    if (fs.existsSync(dst) && fs.readFileSync(dst).equals(fs.readFileSync(src))) { res.same++; continue; }
    (fs.existsSync(dst) ? res.updated : res.new).push(rel);
    if (!rest.includes('--dry')) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }
  }
})('');
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
console.log(`${rest.includes('--dry') ? '[dry] ' : ''}${res.new.length} new, ${res.updated.length} updated, ${res.same} unchanged`);
[...res.new.map(f => '  + ' + f), ...res.updated.map(f => '  ~ ' + f)].slice(0, 60).forEach(l => console.log(l));
