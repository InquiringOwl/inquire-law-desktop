// Layout check: reports, as text, the layout problems screenshots used to catch, so screenshots are taken
// only once a page passes. For each topic, at desktop (1440×900) and phone (400×860) width, in every lab
// mode (and after pressing the first two control buttons), it reports:
//   overflow   the page is wider than the screen
//   clipped    text cut off by a box that hides overflow, or spilling past the screen edge
//   canvas     canvas text drawn partly outside the canvas, or under the mode buttons
//   overlap    two canvas labels drawn on top of each other (measured from every fillText call), or two
//              text elements in a DOM lab's stage on top of each other
//   readout    the readout panel needs scrolling on desktop
//   console    JavaScript errors or console errors/warnings
//   (states: each mode as it opens, after pressing the first two control buttons, and after pressing Step/Next up to 8×)
//   leak       an answer the lab declared with k.guard([...]) (universal kit) is visible (readout, stage text or canvas)
//              when a mode first opens, before any step or control has been used
// Run:  node tools/layoutcheck.js <topic-id> [<id>…]      (no ids: every topic; slower)
//       ONLY=desktop|phone  one width only.
//       LABFILE=path/to/lab.js  inject a lab file after load (it may replace LABS[id] of any topic): prototype or
//       kit-test a lab on an existing page before its own topic exists.   exit code 1 if anything is reported.
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('Layout check needs Playwright (npm install). In the cloud container Chromium is preinstalled.'); process.exit(1); }
const path = require('path'), fs = require('fs'), os = require('os'), vm = require('vm');
const { desktop, dataFiles, R } = require('./build-web.js');

// Records every canvas fillText as a CSS-pixel box, per canvas, reset when a frame clears the canvas.
const INSTRUMENT = () => {
  const P = CanvasRenderingContext2D.prototype, fill = P.fillText, clear = P.clearRect;
  const box = (g, s, x, y) => {
    const m = g.measureText(s), t = g.getTransform(), cv = g.canvas, k = cv.width / Math.max(1, cv.clientWidth);
    if (Math.abs(t.b) > 1e-6 || Math.abs(t.c) > 1e-6) return null;            // rotated text: skip
    const X = v => (t.a * v + t.e) / k, Y = v => (t.d * v + t.f) / k;
    return { s: String(s), x1: X(x - m.actualBoundingBoxLeft), x2: X(x + m.actualBoundingBoxRight), y1: Y(y - m.actualBoundingBoxAscent), y2: Y(y + m.actualBoundingBoxDescent), a: g.globalAlpha };
  };
  P.fillText = function (s, x, y, mw) { try { if (String(s).trim()) { const b = box(this, s, x, y); if (b) (this.canvas.__texts = this.canvas.__texts || []).push(b); } } catch (e) {} return fill.apply(this, arguments); };
  P.clearRect = function (x, y, w, h) { try { const t = this.getTransform(); if (Math.abs(w * t.a * h * t.d) >= 0.9 * this.canvas.width * this.canvas.height) this.canvas.__texts = []; } catch (e) {} return clear.apply(this, arguments); };
};

// Runs in the page: returns a list of problem strings for the current state.
const INSPECT = () => {
  const out = [], vw = innerWidth;
  const de = document.documentElement;
  if (de.scrollWidth > vw + 1) out.push(`overflow: page is ${de.scrollWidth}px wide on a ${vw}px screen`);
  const root = document.querySelector('.topic') || document.body;
  const clips = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflowY)) return p; } return null; };
  const name = el => (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') || el.tagName.toLowerCase();
  const seen = new Set();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const txt = n.textContent.trim(); if (!txt) continue;
    const el = n.parentElement; if (!el || !el.offsetParent) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    for (const b of r.getClientRects()) {
      if (b.width < 1) continue;
      const c = clips(el), cs = c && getComputedStyle(c);
      if (cs && /(auto|scroll)/.test(cs.overflowX + cs.overflowY)) continue;   // inside a scrollable box: fine
      if (b.right > vw + 1 || b.left < -1) { const k = 'edge' + txt; if (!seen.has(k)) { seen.add(k); out.push(`clipped: "${txt.slice(0, 40)}" (${name(el)}) runs past the screen edge`); } }
      if (!c) continue;
      const q = c.getBoundingClientRect();
      if (b.right > q.right + 1 || b.left < q.left - 1 || b.bottom > q.bottom + 1 || b.top < q.top - 1) { const k = 'clip' + txt; if (!seen.has(k)) { seen.add(k); out.push(`clipped: "${txt.slice(0, 40)}" (${name(el)}) is cut off by ${name(c)}`); } }
    }
  }
  // DOM labs (English): text elements in the stage drawn on top of each other (compares line boxes,
  // so a phrase that wraps onto two lines is not mistaken for an overlap)
  const st = document.getElementById('stage');
  if (st) {
    const leaves = [...st.querySelectorAll('*')].filter(e => !e.closest('.modes') && e.offsetParent && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
      .map(e => ({ e, rs: [...e.getClientRects()].filter(r => r.width > 2 && r.height > 2) })).filter(x => x.rs.length);
    for (let i = 0; i < leaves.length && i < 400; i++) for (let j = i + 1; j < leaves.length && j < 400; j++) {
      const a = leaves[i], b = leaves[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const hit = a.rs.some(ra => b.rs.some(rb => { const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        return w > 1 && h > 1 && w * h > 0.25 * Math.min(ra.width * ra.height, rb.width * rb.height); }));
      if (hit) out.push(`overlap: stage text "${a.e.textContent.trim().slice(0, 24)}" and "${b.e.textContent.trim().slice(0, 24)}" overlap`);
    }
  }
  const ro = document.getElementById('readout');
  if (ro && vw > 900 && ro.scrollHeight > ro.clientHeight + 4) out.push(`readout: needs scrolling (${ro.scrollHeight}px of content in ${ro.clientHeight}px)`);
  if (ro && vw > 900) for (const el of ro.querySelectorAll('*')) { const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2) { out.push(`readout: "${el.textContent.trim().slice(0, 30)}" scrolls sideways (${el.scrollWidth}px in ${el.clientWidth}px)`); break; } }
  const modes = [...document.querySelectorAll('.stage .modes button')].map(b => b.getBoundingClientRect());
  for (const cv of document.querySelectorAll('.stage canvas')) {
    if (!cv.clientWidth || !cv.offsetParent) continue;            // hidden canvas (another mode is showing)
    const T = (cv.__texts || []).filter(t => t.a > 0.05), W = cv.clientWidth, H = cv.clientHeight, cr = cv.getBoundingClientRect();
    for (const t of T) {
      if (t.x1 < -1 || t.y1 < -1 || t.x2 > W + 1 || t.y2 > H + 1) out.push(`canvas: label "${t.s.slice(0, 30)}" is drawn partly outside the canvas`);
      for (const m of modes) { const ix = Math.min(t.x2 + cr.left, m.right) - Math.max(t.x1 + cr.left, m.left), iy = Math.min(t.y2 + cr.top, m.bottom) - Math.max(t.y1 + cr.top, m.top); if (ix > 2 && iy > 2) { out.push(`canvas: label "${t.s.slice(0, 30)}" is under the mode buttons`); break; } }
    }
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
      const a = T[i], b = T[j];
      const ix = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1), iy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
      if (ix <= 1 || iy <= 1) continue;
      const small = Math.min((a.x2 - a.x1) * (a.y2 - a.y1), (b.x2 - b.x1) * (b.y2 - b.y1));
      if (ix * iy > 0.15 * small && !(a.s === b.s && Math.abs(a.x1 - b.x1) < 1 && Math.abs(a.y1 - b.y1) < 1)) out.push(`overlap: canvas labels "${a.s.slice(0, 24)}" and "${b.s.slice(0, 24)}" overlap`);
    }
  }
  return [...new Set(out)];
};

// Runs in the page right after a mode opens: answers declared on the stage (data-answers) must not be visible yet.
const LEAK = () => {
  const st = document.getElementById('stage'); if (!st || !st.dataset.answers) return [];
  const norm = s => String(s).replace(/[\s\u00a0]+/g, '').replace(/[-\u2013]/g, '\u2212');
  const shown = norm((document.getElementById('readout') || {}).innerText || '') + '|' + norm(st.innerText) + '|' + [...st.querySelectorAll('canvas')].filter(c => c.clientWidth && c.offsetParent).map(c => (c.__texts || []).filter(t => t.a > 0.05).map(t => norm(t.s)).join('|')).join('|');
  return JSON.parse(st.dataset.answers).filter(a => shown.includes(norm(a))).map(a => `leak: answer "${a}" is visible before any step`);
};

(async () => {
  const ctx = vm.createContext({}); ctx.window = ctx;
  for (const f of dataFiles.filter(f => f.startsWith('web/src/'))) vm.runInContext(fs.readFileSync(path.join(R, f), 'utf8'), ctx);
  const all = Object.values(ctx.DB.trees).flatMap(t => t.nodes.map(n => n.id));
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : all;
  const bad = ids.filter(i => !all.includes(i)); if (bad.length) { console.error('Unknown topic id(s): ' + bad.join(', ')); process.exit(1); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inqlaw-layout-')), file = path.join(dir, 'index.html');
  fs.writeFileSync(file, desktop.replace('href="fonts/fonts.css"', `href="file://${path.join(R, 'app/fonts/fonts.css')}"`).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, ''));
  const widths = [['desktop', { width: 1440, height: 900 }], ['phone', { width: 400, height: 860 }]].filter(([k]) => !process.env.ONLY || process.env.ONLY === k);
  const browser = await chromium.launch();
  let total = 0;
  for (const [label, viewport] of widths) {
    const p = await browser.newPage({ viewport });
    await p.addInitScript(INSTRUMENT);
    let errs = [];
    p.on('pageerror', e => errs.push('console: page error: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`console: ${m.type()}: ${m.text()}`); });
    await p.goto('file://' + file + '#menu'); await p.waitForTimeout(400);
    if (process.env.LABFILE) await p.addScriptTag({ path: path.resolve(process.env.LABFILE) });
    for (const id of ids) {
      errs = [];
      await p.evaluate(h => { location.hash = h; }, id); await p.waitForTimeout(700);
      const report = new Map(), add = (tag, list) => list.forEach(x => { if (!report.has(x)) report.set(x, []); report.get(x).push(tag); });
      const nModes = await p.$$eval('.stage .modes button', b => b.length);
      for (let m = 0; m < Math.max(1, nModes); m++) {
        let modeName = '';
        if (nModes) { const b = (await p.$$('.stage .modes button'))[m]; modeName = (await b.textContent()).trim(); await b.click(); await p.waitForTimeout(350); }
        const tag = modeName ? `mode "${modeName}"` : 'default';
        add(tag, [...await p.evaluate(INSPECT), ...await p.evaluate(LEAK)]);
        for (const b of (await p.$$('#controls button')).slice(0, 2)) { try { await b.click({ timeout: 800 }); } catch (e) {} await p.waitForTimeout(250); }
        await p.waitForTimeout(400);
        add(tag + ' after controls', await p.evaluate(INSPECT));
        // later states: press Step/Next up to 8 times (stepper labs), then inspect the final state
        let stepped = 0;
        for (let i = 0; i < 8; i++) { const btns = await p.$$('#controls button'); let hit = null; for (const b of btns) { const t = ((await b.textContent()) || '').trim(); if (/^(step|next)\b/i.test(t) && await b.isVisible()) { hit = b; break; } } if (!hit) break; try { await hit.click({ timeout: 800 }); stepped++; } catch (e) { break; } await p.waitForTimeout(120); }
        if (stepped) { await p.waitForTimeout(350); add(tag + ' after steps', await p.evaluate(INSPECT)); }
      }
      const lines = [...[...report].map(([x, tags]) => `${x}  [${tags.length > 3 ? tags.length + ' states' : tags.join('; ')}]`), ...new Set(errs)];
      total += lines.length;
      console.log(`${lines.length ? 'ISSUES' : 'ok    '} ${id} (${label})${lines.length ? '\n  ' + lines.join('\n  ') : ''}`);
    }
    await p.close();
  }
  await browser.close(); fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${ids.length} topic(s) × ${widths.length} width(s): ${total} issue(s)`);
  process.exit(total ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
