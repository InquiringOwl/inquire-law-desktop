// Contact sheet: ONE image per topic showing its lab in every mode at desktop and phone width,
// so a visual review costs one image read instead of one per mode per width.
// Run layoutcheck.js first; take sheets only once a topic passes it.
//   node tools/sheet.js <topic-id> [<id>…]     → /tmp/inqlaw-sheet/<id>.png
//   CLICK=1   also press the first two control buttons in each mode before the shot
//   FULL=1    include the whole page (dossier text) at desktop width as an extra tile
//   MODES=Graph,Steps   only modes whose button text contains one of these (case-insensitive)
//   LABFILE=path/to/lab.js   inject a lab file first (may replace LABS[id]; see layoutcheck.js)
//   BIG=1     full-size sheet (default is ~0.65 scale: about 40 % of the pixels, still legible; image cost scales with pixels)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const { desktop, R } = require('./build-web.js');
(async () => {
  const ids = process.argv.slice(2); if (!ids.length) { console.error('usage: node tools/sheet.js <topic-id> [<id>…]'); process.exit(1); }
  const S = process.env.BIG ? 1 : 0.65;
  const out = '/tmp/inqlaw-sheet'; fs.mkdirSync(out, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inqlaw-sheet-')), file = path.join(dir, 'index.html');
  fs.writeFileSync(file, desktop.replace('href="fonts/fonts.css"', `href="file://${path.join(R, 'app/fonts/fonts.css')}"`).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, ''));
  const b = await chromium.launch(), errs = [];
  const shoot = async (viewport, id) => {
    const p = await b.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    p.on('pageerror', e => errs.push(`${id}: page error: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${id}: ${m.text()}`); });
    if (process.env.LABFILE) { await p.goto('file://' + file + '#menu'); await p.waitForTimeout(300); await p.addScriptTag({ path: path.resolve(process.env.LABFILE) }); await p.evaluate(h => { location.hash = h; }, id); }
    else await p.goto('file://' + file + '#' + id);
    // phone: a tall window so the whole stacked lab fits in one shot, with the stage kept at its 860-px-high size
    if (viewport.tall) await p.addStyleTag({ content: `.stage{height:${Math.round(Math.min(620, Math.max(380, 0.6 * viewport.tall)))}px!important}` });
    await p.waitForTimeout(900);
    const tiles = [], n = await p.$$eval('.stage .modes button', x => x.length);
    for (let m = 0; m < Math.max(1, n); m++) {
      let name = 'default';
      if (n && process.env.MODES) { const nm = (await (await p.$$('.stage .modes button'))[m].textContent()).trim().toLowerCase(); if (!process.env.MODES.toLowerCase().split(',').some(w => nm.includes(w.trim()))) continue; }
      if (n) { const btn = (await p.$$('.stage .modes button'))[m]; name = (await btn.textContent()).trim(); await btn.click(); await p.waitForTimeout(400); }
      if (process.env.CLICK) { for (const x of (await p.$$('#controls button')).slice(0, 2)) { try { await x.click({ timeout: 800 }); } catch (e) {} await p.waitForTimeout(400); } }
      const lab = await p.$('section.lab');
      tiles.push({ name, png: (await (lab || p).screenshot()).toString('base64') });
    }
    if (process.env.FULL && viewport.width > 900) { await p.evaluate(() => { const t = document.querySelector('.topic'); if (t) t.scrollTop = 0; }); const pg = await p.$('.topic .wrap'); tiles.push({ name: 'page', png: (await (pg || p).screenshot({ fullPage: !pg })).toString('base64') }); }
    await p.close(); return tiles;
  };
  for (const id of ids) {
    const D = await shoot({ width: 1440, height: 900 }, id), Ph = await shoot({ width: 400, height: 1700, tall: 860 }, id);
    const rows = D.map((t, i) => `<div class="row"><div class="lbl">${t.name}</div><img class="d" src="data:image/png;base64,${t.png}">${Ph[i] ? `<img class="p" src="data:image/png;base64,${Ph[i].png}">` : ''}</div>`).join('');
    const html = `<html><body style="margin:0;background:#0b0f19;font:13px sans-serif;color:#9aa">
      <style>.row{display:flex;gap:${Math.round(12*S)}px;align-items:flex-start;padding:${Math.round(10*S)}px;border-bottom:1px solid #223}.lbl{width:${Math.round(90*S)}px;flex:none;font-size:${Math.max(10,Math.round(13*S))}px}.d{width:${Math.round(760*S)}px}.p{width:${Math.round(240*S)}px}</style>
      <div style="padding:10px;color:#ccd">${id}: desktop 1440 (left, scaled) · phone 400 (right, scaled)</div>${rows}</body></html>`;
    const p = await b.newPage({ viewport: { width: Math.round(1130 * S), height: 400 } });
    await p.setContent(html); await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/${id}.png`, fullPage: true }); await p.close();
    console.log(`${id} → ${out}/${id}.png (${D.length} mode${D.length > 1 ? 's' : ''})`);
  }
  console.log(errs.length ? [...new Set(errs)].join('\n') : 'no console errors');
  await b.close(); fs.rmSync(dir, { recursive: true, force: true });
})().catch(e => { console.error(e); process.exit(1); });
