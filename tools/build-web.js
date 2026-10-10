// Builds the Inquire Law page from web/src + web/content.
//   app/index.html          desktop app page (fonts bundled, works offline)
//   dist-web/inquire-law.html     page body for the claude.ai artifact (fonts from Google Fonts)
// Run: node tools/build-web.js
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(R, p), 'utf8');

const css = read('web/src/style.css') + '\n' + read('web/src/intro.css') + '\n' + read('web/src/settings.css') + '\n' + read('web/src/menu.css');
// Logo mark for the top bar, inlined so it works in the desktop page and the claude.ai artifact alike.
const markUri = 'data:image/png;base64,' + fs.readFileSync(path.join(R, 'app/intro/inq-mark-64.png')).toString('base64');
// Menu display-box screenshots (app/menu/*.jpg), inlined as data URIs into window.InquireArt (desktop page and claude.ai artifact alike).
const artDir = path.join(R, 'app/menu');
const artJs = 'window.InquireArt = ' + JSON.stringify(Object.fromEntries((fs.existsSync(artDir) ? fs.readdirSync(artDir) : []).filter(f => /\.jpe?g$/.test(f)).sort()
  .map(f => [f.replace(/\.jpe?g$/, ''), 'data:image/jpeg;base64,' + fs.readFileSync(path.join(artDir, f)).toString('base64')]))) + ';';
const dir = d => fs.existsSync(path.join(R, d)) ? fs.readdirSync(path.join(R, d)).filter(f => f.endsWith('.js')).sort().map(f => d + '/' + f) : [];
// Content is one file per topic: web/content/<field>/<topic-id>.js
const tree = d => fs.existsSync(path.join(R, d)) ? fs.readdirSync(path.join(R, d), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(e => e.isDirectory() ? tree(d + '/' + e.name) : e.name.endsWith('.js') ? [d + '/' + e.name] : []) : [];
// Order matters: data (data.js, then each subject's web/src/data-<subject>.js), story art (web/art), every content file,
// then the lab kits by layer (web/kits/universal → categorical → subjects, each alphabetical), every lab file, then the app.
const kitFiles = [...dir('web/kits/universal'), ...dir('web/kits/categorical'), ...dir('web/kits/subjects')];
const dataSrc = ['web/src/data.js', ...dir('web/src').filter(f => /\/data-[a-z0-9-]+\.js$/.test(f))];
// Glossary entries (web/glossary/<subject>.js) come right after the data files: they only call DB.addGlossary.
const files = [...dataSrc, ...dir('web/glossary'), ...dir('web/art'), ...tree('web/content'), ...kitFiles,
  ...dir('web/src').filter(f => /\/labs\d*\.js$/.test(f)), ...dir('web/traces'), ...dir('web/labs'), 'web/src/notes.js', 'web/src/notes-widgets.js', 'web/src/app.js', 'web/src/dock.js', 'web/src/achievements.js', 'web/src/textmenu.js', 'web/src/intro.js', 'web/src/eula.js', 'web/src/settings.js'];
// Files that only define data (DB, ARITH, scenes): safe to run in Node for validate, dump-content and smoke.
const dataFiles = files.filter(f => dataSrc.includes(f) || f.startsWith('web/glossary/') || f.startsWith('web/art/') || f.startsWith('web/content/'));
const vm = require('vm');
function scripts({ lenient = false } = {}) {
  // One <script> per source file, so a problem in one file is easy to find.
  const out = [];
  for (const f of files) {
    const src = read(f);
    if (/<\/script/i.test(src)) throw new Error(f + ' contains </script>, which would break the page.');
    try { new vm.Script(src, { filename: f }); }
    catch (e) { if (lenient) { console.warn('SKIPPED (syntax error) ' + f + ': ' + e.message); continue; } throw new Error(f + ': ' + e.message); }
    out.push(`<script>/* ${f} */\n${src}\n</script>`);
  }
  return `<script>/* menu art */\n${artJs}\n</script>\n` + out.join('\n');
}
const js = scripts({ lenient: require.main !== module });

const body = `<div id="app">
  <header class="topbar">
    <button type="button" class="brand" id="brand" aria-label="Inquire Law main menu"><span class="brand-mark"><img src="${markUri}" alt="" width="30" height="30"></span><span class="brand-name">Inquire Law</span></button>
    <nav class="crumbs" id="crumbs" aria-label="Breadcrumb"></nav>
    <button type="button" class="topstat" id="topstat" aria-haspopup="dialog" title="Progress · choose what it follows"><span id="stat-t"></span><span class="meter" aria-hidden="true"><i id="stat-m"></i></span></button>
    <button type="button" class="gear" id="gear" title="Settings (Esc)">Settings</button>
    <button type="button" class="whoami" id="whoami" hidden></button>
  </header>
  <main class="view" id="view" tabindex="-1"></main>
  <div class="upd" id="upd" role="status" hidden></div>
</div>
${js}
`;

const desktop = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' inqlaw:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' inqlaw:; img-src 'self' data: blob: https: inqlaw:; media-src 'self' blob: https: inqlaw:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com">
<title>Inquire Law</title>
<link rel="stylesheet" href="fonts/fonts.css">
<style>
${css}
</style>
</head><body>
${body}
</body></html>
`;

const web = `<title>Inquire Law Math Dictionary</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400;0,600;1,400;1,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&family=Saira+Semi+Condensed:wght@400;500;600&family=Noto+Sans+Symbols&display=swap">
<style>
${css}
</style>
${body}`;

module.exports = { files, dataFiles, desktop, R };
if (require.main !== module) return;
fs.writeFileSync(path.join(R, 'app/index.html'), desktop);
fs.mkdirSync(path.join(R, 'dist-web'), { recursive: true });
fs.writeFileSync(path.join(R, 'dist-web/inquire-law.html'), web);
console.log('app/index.html', desktop.length, 'bytes; dist-web/inquire-law.html', web.length, 'bytes');
