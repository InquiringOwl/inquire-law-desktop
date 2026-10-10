// Smoke test: opens the built page in headless Chromium and visits every screen:
// menu, My notes, dictionary, each subject's field map, every field page (tree or planned dossier), and every topic page.
// On each topic page it checks the dossier and lab rendered, clicks the first two
// lab buttons, and fails on any JavaScript error or console error/warning.
// Run: node tools/smoke.js          (needs playwright; exit code 1 on any failure)
//      ONLY=a1-slope,field-algebra-1 node tools/smoke.js   checks just those screens
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  console.error('Smoke test needs Playwright. One-time setup, in this folder:\n  npm install --save-dev playwright@1.56.0 && npx playwright install chromium');
  process.exit(1);
}
const path = require('path'), fs = require('fs'), os = require('os');
const { desktop, dataFiles, R } = require('./build-web.js');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inqlaw-smoke-'));
  const page = path.join(dir, 'index.html');
  fs.writeFileSync(page, desktop
    .replace('href="fonts/fonts.css"', `href="file://${path.join(R, 'app/fonts/fonts.css')}"`)
    .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, ''));

  const vm = require('vm'), ctx = vm.createContext({}); ctx.window = ctx;
  for (const f of dataFiles.filter(f => f.startsWith('web/src/'))) vm.runInContext(fs.readFileSync(path.join(R, f), 'utf8'), ctx);
  const DB = ctx.DB;
  const fields = Object.keys(DB.trees);
  const topics = fields.flatMap(f => DB.trees[f].nodes.map(n => n.id));
  const maps = Object.keys(DB.subjectMaps || {}).map(sub => sub === DB.defaultSubject ? 'field-map' : 'field-map-' + sub);
  const planned = Object.keys(DB.fields).filter(f => !DB.trees[f]);
  const T0 = topics[0] || 'menu';
  let routes = ['menu', 'notes', 'achievements', 'dict', 'glossary', 'glossary-' + DB.defaultSubject, 'glossary~word', 'field-map~word', T0 + '~word', ...maps, ...fields.map(f => 'field-' + f), ...planned.map(f => 'field-' + f), ...topics];
  if (process.env.ONLY) routes = process.env.ONLY.split(',').map(s => s.trim()).filter(Boolean);

  const browser = await chromium.launch();
  const failures = [];
  for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 400, height: 860 }]]) {
    const p = await browser.newPage({ viewport });
    process.stdout.write(`Smoke test, ${label} width: ${routes.length} screens `);
    let errs = [];
    p.on('pageerror', e => errs.push('page error: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`console ${m.type()}: ${m.text()}`); });
    await p.goto('file://' + page + '#menu');
    await p.waitForTimeout(500);
    for (const e of [...new Set(errs)]) failures.push(`${label} page load: ${e}`);
    for (const r of routes) {
      errs = [];
      await p.evaluate(h => { location.hash = h; }, r);
      await p.waitForTimeout(250);
      const info = await p.evaluate(() => ({
        view: (document.getElementById('view') || {}).innerHTML?.length || 0,
        title: document.querySelector('.topic h1')?.textContent || '',
        stub: /coming soon/i.test(document.getElementById('view')?.textContent || ''),
        lab: !!document.querySelector('#controls, canvas, svg'),
      }));
      if (!info.view) errs.push('view is empty');
      if (topics.includes(r)) {
        if (info.stub) errs.push('shows the "coming soon" stub');
        if (!info.lab) errs.push('no lab rendered');
        for (const b of (await p.$$('#controls button')).slice(0, 2)) { try { await b.click({ timeout: 1000 }); } catch (e) {} await p.waitForTimeout(150); }
        await p.waitForTimeout(150);
      }
      for (const e of [...new Set(errs)]) failures.push(`${label} #${r}: ${e}`);
      process.stdout.write(errs.length ? 'x' : '.');
    }
    // Windows that are not routes: the settings window (every tab), the Assist dock (both tabs, the Notes box, a note made from a
    // topic page, which then shows on My notes) and the menu's display box arrows. Skipped when ONLY names screens.
    if (!process.env.ONLY) {
      errs = [];
      try {
        await p.evaluate(t => { location.hash = t; }, T0); await p.waitForTimeout(300);
        for (const t of ['look', 'display', 'keys', 'usage', 'account', 'data', 'about']) { await p.evaluate(t => InquireSettings.open(t), t); await p.waitForTimeout(120); }
        await p.evaluate(() => InquireSettings.openDoc('eula')); await p.waitForTimeout(120);
        await p.evaluate(() => InquireSettings.close());
        await p.click('.dk-rail [data-go=ai]'); await p.waitForTimeout(150);
        await p.fill('.dk-ask textarea', 'test'); await p.click('.dk-ask button'); await p.waitForTimeout(200);
        await p.click('.dk-tabs [data-t=chat]'); await p.click('#dk-win .dk-ic[data-go=notes]'); await p.waitForTimeout(150); await p.click('#dk-notes [data-a=gen]'); await p.waitForTimeout(500);
        const body = await p.$eval('.dk-nbody .nb-rich', el => el.textContent.length);
        if (body < 100) errs.push('note from this page came out empty');
        await p.evaluate(() => InquireDock.close()); await p.click('.dkn-x');
        await p.evaluate(() => { location.hash = 'notes'; }); await p.waitForTimeout(300);
        if (!(await p.$('.nb-it'))) errs.push('My notes does not list the new note');
        await p.evaluate(() => { location.hash = 'menu'; }); await p.waitForTimeout(300);
        await p.click('.mx-arrow[data-d="1"]'); await p.waitForTimeout(200);
        if (!(await p.$('.mnote'))) errs.push('menu notes strip is empty');
        await p.evaluate(() => { localStorage.clear(); });
      } catch (e) { errs.push('windows: ' + e.message.split('\n')[0]); }
      for (const e of [...new Set(errs)]) failures.push(`${label} windows: ${e}`);
      process.stdout.write(errs.length ? 'x' : '.');
    }
    process.stdout.write(' done\n');
    await p.close();
  }
  await browser.close();
  fs.rmSync(dir, { recursive: true, force: true });
  failures.forEach(f => console.log('FAIL ' + f));
  console.log(`${routes.length} screens × 2 widths checked: ${failures.length} failure(s)`);
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
