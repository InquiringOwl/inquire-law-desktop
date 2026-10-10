// Dev check for one or more pages, safe to run from several shells at once.
//   node tools/snap.js <hash> [<hash>…]        e.g.  node tools/snap.js a1-quad-formula field-algebra-1
//   CLICK=1 node tools/snap.js <id>              also clicks the first two lab buttons before the screenshot
// Builds a private copy of the page (files with syntax errors are skipped and reported),
// then writes /tmp/inqlaw-snap/<hash>.png and prints console errors. Needs playwright (NODE_PATH=$(npm root -g)).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { desktop, R } = require('./build-web.js');
(async () => {
  const out = '/tmp/inqlaw-snap'; fs.mkdirSync(out, { recursive: true });
  const page = path.join(out, `page-${process.pid}.html`);
  fs.writeFileSync(page, desktop.replace('href="fonts/fonts.css"', `href="file://${path.join(R, 'app/fonts/fonts.css')}"`).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, ''));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +(process.env.W || 1440), height: +(process.env.H || 900) } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type().toUpperCase() + ' ' + m.text()); });
  for (const h of process.argv.slice(2)) {
    await p.goto('file://' + page + '#' + h); await p.waitForTimeout(900);
    if (process.env.CLICK) { const bs = await p.$$('#controls button'); for (const x of bs.slice(0, 2)) { try { await x.click(); } catch (e) {} await p.waitForTimeout(500); } }
    await p.evaluate(() => { const t = document.querySelector('.topic'); if (t) t.scrollTop = 0; });
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/${h}.png` });
    const ro = await p.evaluate(() => document.getElementById('readout') ? document.getElementById('readout').innerText.length : -1);
    console.log(h, '→', `${out}/${h}.png`, ro >= 0 ? `(readout ${ro} chars)` : '');
  }
  console.log(errs.length ? [...new Set(errs)].join('\n') : 'no console errors');
  fs.rmSync(page, { force: true });
  await b.close();
})();
