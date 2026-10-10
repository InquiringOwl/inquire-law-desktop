/* ============ Subject kit: Computer Science (Programming Fundamentals onward) ============
   Every program a lab shows is REAL Python: write it in web/cs-src/<topic-id>.py and run
   `python3 tools/pytrace.py <topic-id>`; that records each step CPython takes into web/traces/<topic-id>.js
   (window.CSTraces["<id>/<program>"]). Labs only play traces back, so a lab can never disagree with Python.
   Two layers:
   1. window.CSRules (CR): pure, DOM-free rules, tested in tests/cs.test.js (node tools/labtest.js cs):
      tokens(line) Python highlighting · show(val, heap) Python-style display text · frames/out/changed per step ·
      watch(trace, name) a variable's value at every step · bits (toBase, fromBase, twos, fromTwos, utf8) · shuffle(arr, seed).
   2. window.CSKit.attach(k): k.trace(cfg) the whole Trace / Memory / Array lab in one call, k.predict(cfg) predict-then-run,
      k.bits(cfg) bit board, k.csModes(list, build) mode switching, k.guard(list), k.csro(o) standard readout.
   House colour keys for every CS page (the legend must use them): c1 amber = line about to run, c2 cyan = variable that
   just changed, c3 pink = output, c4 violet = references / objects, c5 green = return values. */
(function(){
const W = window;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------------- 1. CSRules ---------------- */
const KW = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(" "));
const BI = new Set("print input int float str bool len range list dict set tuple sum min max abs round sorted enumerate zip type isinstance open map filter reversed any all chr ord".split(" "));
function tokens(line){
  const out = []; let i = 0;
  const push = (t, s) => { if (s) out.push({ t, s }); };
  while (i < line.length) {
    const r = line.slice(i);
    let m;
    if ((m = r.match(/^#.*/))) { push("com", m[0]); break; }
    if ((m = r.match(/^[rRbBfF]{0,2}("""|'''|"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)/)) && (m[1] !== '"""' && m[1] !== "'''" || true)) { push("str", m[0]); i += m[0].length; continue; }
    if ((m = r.match(/^\d+(\.\d*)?([eE][+-]?\d+)?j?|^\.\d+/))) { push("num", m[0]); i += m[0].length; continue; }
    if ((m = r.match(/^[A-Za-z_]\w*/))) { const w = m[0]; push(KW.has(w) ? "kw" : BI.has(w) ? "bi" : "name", w); i += w.length; continue; }
    if ((m = r.match(/^\s+/))) { push("ws", m[0]); i += m[0].length; continue; }
    push("op", line[i]); i++;
  }
  // merge neighbouring ops/ws so the HTML stays small
  return out.reduce((a, x) => { const l = a[a.length - 1]; if (l && l.t === x.t && (x.t === "op" || x.t === "ws")) l.s += x.s; else a.push({ ...x }); return a; }, []);
}

// Display text for a traced value, Python style. Cycles show as [...].
function show(v, heap, seen = new Set()){
  if (!v) return "";
  const [kind, x] = v;
  if (kind === "v") return x;
  if (kind === "fn") return `function ${x}`;
  if (kind === "cls") return `class ${x}`;
  const o = heap[x]; if (!o) return "…";
  if (o.t === "val") return o.v;
  if (seen.has(x)) return o.t === "dict" ? "{...}" : "[...]";
  const s2 = new Set(seen); s2.add(x);
  const items = o.t === "dict" || o.t === "obj" ? null : o.v.map(e => show(e, heap, s2));
  if (o.t === "list") return `[${items.join(", ")}]`;
  if (o.t === "tuple") return items.length === 1 ? `(${items[0]},)` : `(${items.join(", ")})`;
  if (o.t === "set") return items.length ? `{${items.join(", ")}}` : "set()";
  if (o.t === "dict") return `{${o.v.map(([a, b]) => show(a, heap, s2) + ": " + show(b, heap, s2)).join(", ")}}`;
  return `${o.c}(${o.v.map(([a, b]) => a + "=" + show(b, heap, s2)).join(", ")})`;
}

const stepAt = (T, i) => T.steps[Math.max(0, Math.min(T.steps.length - 1, i))];
const outAt = (T, i) => T.out.slice(0, stepAt(T, i).o);
// How many times line `line` has started running in steps 0…i (loop passes: give the first line of the body).
const hits = (T, i, line) => T.steps.slice(0, Math.max(0, i) + 1).filter(s => s.ev === "line" && s.l === line).length;
// Names whose shown value differs from the step before: Set of "depth:name" (depth 0 = global frame).
function changed(T, i){
  const res = new Set(); if (i <= 0) return res;
  const a = stepAt(T, i - 1), b = stepAt(T, i);
  b.f.forEach((fr, d) => {
    const pf = a.f[d] && a.f[d].fn === fr.fn ? a.f[d] : null;
    for (const [n, v] of Object.entries(fr.vars)) if (!pf || !(n in pf.vars) || show(pf.vars[n], a.h) !== show(v, b.h)) res.add(d + ":" + n);
  });
  return res;
}
// A global (or innermost-frame, inner: true) variable's shown value at every step; undefined before it exists.
const watch = (T, name, inner) => T.steps.map(s => { const fr = inner ? s.f[s.f.length - 1] : s.f[0]; return fr && name in fr.vars ? show(fr.vars[name], s.h) : undefined; });
// Python list of numbers at step i as a JS array (for the array view), or null.
function nums(T, i, name){
  const s = stepAt(T, i); const fr = s.f.find(f => name in f.vars) ; const v = fr && fr.vars[name];
  if (!v || v[0] !== "r" || !s.h[v[1]] || s.h[v[1]].t !== "list") return null;
  return s.h[v[1]].v.map(e => (e[0] === "v" ? Number(e[1]) : NaN));
}
const evText = (T, i) => { const s = stepAt(T, i), fn = s.f.length ? s.f[s.f.length - 1].fn : "";
  return s.ev === "end" ? "program finished" : s.ev === "call" ? `calling ${fn}()` : s.ev === "return" ? `${fn}() returns ${show(s.r, s.h)}` : s.ev === "exc" ? "an exception is raised" : `about to run line ${s.l}`; };

// Bits. toBase(13, 2, 8) = "00001101"; fromBase("ff", 16) = 255; twos(-3, 8) = "11111101"; fromTwos("11111101") = -3.
const toBase = (n, b, w = 0) => { if (!Number.isInteger(n) || n < 0) throw new Error("CSRules.toBase: needs a whole number ≥ 0 (use twos for negatives)"); return n.toString(b).toUpperCase().padStart(w, "0"); };
const fromBase = (s, b) => { const v = parseInt(String(s).replace(/_/g, ""), b); if (!Number.isFinite(v)) throw new Error(`CSRules.fromBase: "${s}" is not base ${b}`); return v; };
const twos = (n, w) => { const lo = -(2 ** (w - 1)), hi = 2 ** (w - 1) - 1; if (n < lo || n > hi) throw new Error(`CSRules.twos: ${n} does not fit in ${w} bits (${lo}…${hi})`); return toBase(n < 0 ? 2 ** w + n : n, 2, w); };
const fromTwos = bits => { const w = bits.length, u = fromBase(bits, 2); return bits[0] === "1" ? u - 2 ** w : u; };
const utf8 = ch => { const c = ch.codePointAt(0); if (c < 0x80) return [c]; if (c < 0x800) return [0xC0 | c >> 6, 0x80 | c & 63];
  if (c < 0x10000) return [0xE0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63]; return [0xF0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63]; };
const shuffle = (arr, seed) => { const a = arr.slice(); let s = seed == null ? null : seed;
  const rnd = () => { if (s == null) return Math.random(); s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const CR = W.CSRules = { tokens, show, stepAt, outAt, hits, changed, watch, nums, evText, toBase, fromBase, twos, fromTwos, utf8, shuffle, esc };

/* ---------------- 2. CSKit ---------------- */
const CSS = `
.stage .dom.cs{position:absolute;inset:0;overflow:auto;padding:58px 16px 16px;display:grid;gap:12px;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);grid-auto-rows:max-content;align-content:start;align-items:start}
.stage .dom.cs.one{grid-template-columns:minmax(0,1fr)}
.cs .pane{background:rgba(10,14,24,.55);border:1px solid var(--line);border-radius:5px;min-width:0;overflow:auto}
.cs .pane h3{font:500 11px/1 var(--ui);letter-spacing:.18em;text-transform:uppercase;color:var(--faint);margin:0;padding:8px 10px 6px}
.cs-code{font:400 13px/1.55 var(--mono);margin:0;padding:0 0 6px;counter-reset:ln}
.cs-code .ln{display:flex;white-space:pre-wrap;overflow-wrap:anywhere;padding:0 10px 0 0;border-left:3px solid transparent}
.cs-code .ln::before{counter-increment:ln;content:counter(ln);width:2.4em;flex:none;text-align:right;padding-right:10px;color:var(--faint)}
.cs-code .ln .tx{min-width:0;white-space:pre-wrap;overflow-wrap:anywhere}
.cs-code .ln.cur{background:rgba(242,184,75,.14);border-left-color:var(--amber)}
.cs-code .ln.prev{border-left-color:rgba(242,184,75,.35)}
.cs-code .kw{color:var(--violet)} .cs-code .bi{color:var(--cyan)} .cs-code .str{color:var(--green)} .cs-code .num{color:var(--pink)} .cs-code .com{color:var(--faint);font-style:italic}
.cs-vars{font:400 13px/1.4 var(--mono);padding:0 10px 8px;display:grid;gap:8px}
.cs-fr{border:1px solid var(--line);border-radius:4px}
.cs-fr .fn{font:500 11px/1 var(--ui);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:6px 8px;border-bottom:1px solid var(--line)}
.cs-fr.top .fn{color:var(--amber)}
.cs-fr table{border-collapse:collapse;width:100%}
.cs-fr td{padding:3px 8px;vertical-align:top;overflow-wrap:anywhere}
.cs-fr td:first-child{color:var(--muted);width:1%;white-space:nowrap}
.cs-fr tr.ch td:last-child{color:var(--cyan)}
.cs-fr tr.ret td{color:var(--green)}
.cs-out{grid-column:1/-1;min-height:64px}
.cs-out pre{font:400 13px/1.45 var(--mono);color:var(--pink);margin:0;padding:0 10px 8px;white-space:pre-wrap;overflow-wrap:anywhere}
.cs-out pre .err{color:var(--red,#ff6b6b)}
.cs svg{display:block;width:100%;height:auto}
.cs-pick{display:flex;flex-wrap:wrap;gap:8px;padding:0 10px 10px}
.cs-pick button{font:400 13px/1.3 var(--mono);white-space:pre-wrap;text-align:left;color:var(--text);background:var(--panel-2);border:1px solid var(--line);border-radius:4px;padding:8px 10px;cursor:pointer}
.cs-pick button.right{border-color:var(--green);color:var(--green)} .cs-pick button.wrong{border-color:var(--pink);color:var(--pink)}
.cs-bits{display:flex;flex-wrap:wrap;gap:6px;padding:0 10px 10px}
.cs-bits button{font:500 20px/1 var(--mono);width:40px;height:48px;color:var(--muted);background:var(--panel-2);border:1px solid var(--line);border-radius:4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
.cs-bits button.on{color:var(--ink);background:var(--amber);border-color:var(--amber)}
.cs-bits button small{font:400 10px/1 var(--mono);opacity:.75}
@media (max-width:700px){.stage .dom.cs{grid-template-columns:minmax(0,1fr);padding:54px 10px 10px}.cs-code,.cs-vars,.cs-out pre{font-size:12px}.cs-bits{gap:4px}.cs-bits button{width:32px;height:44px;font-size:17px}}`;
function css(){ if (typeof document === "undefined" || document.getElementById("cs-kit-css")) return; const s = document.createElement("style"); s.id = "cs-kit-css"; s.textContent = CSS; document.head.appendChild(s); }

const codeHTML = code => code.replace(/\n$/, "").split("\n").map(l => `<div class="ln"><span class="tx">${tokens(l).map(x => x.t === "ws" || x.t === "op" || x.t === "name" ? esc(x.s) : `<span class="${x.t}">${esc(x.s)}</span>`).join("") || " "}</span></div>`).join("");

function varsHTML(T, i){
  const s = stepAt(T, i), ch = changed(T, i), n = s.f.length;
  return s.f.slice().reverse().map((fr, ri) => { const d = n - 1 - ri;
    const rows = Object.entries(fr.vars).map(([k, v]) => `<tr class="${ch.has(d + ":" + k) ? "ch" : ""}"><td>${esc(k)}</td><td>${esc(show(v, s.h))}</td></tr>`).join("")
      + (s.ev === "return" && d === n - 1 ? `<tr class="ret"><td>return</td><td>${esc(show(s.r, s.h))}</td></tr>` : "");
    return `<div class="cs-fr${ri === 0 && n > 1 ? " top" : ""}"><div class="fn">${fr.fn === "global" ? "global frame" : esc(fr.fn) + "()"}</div><table>${rows || `<tr><td>—</td><td></td></tr>`}</table></div>`; }).join("");
}

// Memory diagram: frames (names) on the left, objects on the right, arrows (c4) from each reference.
function memorySVG(T, i){
  const s = stepAt(T, i), ch = changed(T, i), CW = 7.9, RH = 22, P = 8;
  const refs = [], seen = new Set();
  const visit = v => { if (v && v[0] === "r" && !seen.has(v[1]) && s.h[v[1]]) { seen.add(v[1]); refs.push(v[1]); const o = s.h[v[1]]; if (o.t === "val") return; (o.t === "dict" ? o.v.flat() : o.t === "obj" ? o.v.map(e => e[1]) : o.v).forEach(visit); } };
  s.f.forEach(fr => Object.values(fr.vars).forEach(visit));
  const cellTxt = v => (v[0] === "r" ? "" : show(v, s.h));
  let y = 10, fx = 10; const fw = Math.max(150, ...s.f.flatMap(fr => Object.entries(fr.vars).map(([k, v]) => (k.length + cellTxt(v).length) * CW + 40)));
  const parts = [], dots = [], boxes = {};
  s.f.forEach((fr, d) => {
    const names = Object.entries(fr.vars); const h = 22 + Math.max(1, names.length) * RH;
    parts.push(`<rect x="${fx}" y="${y}" width="${fw}" height="${h}" rx="4" fill="none" stroke="var(--line-2)"/><text x="${fx + P}" y="${y + 15}" font-family="var(--ui)" font-size="11" letter-spacing="1.5" fill="${d === s.f.length - 1 && s.f.length > 1 ? "var(--amber)" : "var(--muted)"}">${fr.fn === "global" ? "GLOBAL FRAME" : esc(fr.fn.toUpperCase()) + "()"}</text>`);
    names.forEach(([k, v], j) => { const ty = y + 22 + j * RH + 15, c = ch.has(d + ":" + k) ? "var(--cyan)" : "var(--text)";
      parts.push(`<text x="${fx + P}" y="${ty}" font-family="var(--mono)" font-size="13" fill="var(--muted)">${esc(k)}</text>`);
      if (v[0] === "r") dots.push({ x: fx + fw - 14, y: ty - 4, to: v[1] }); else parts.push(`<text x="${fx + fw - P}" y="${ty}" text-anchor="end" font-family="var(--mono)" font-size="13" fill="${c}">${esc(cellTxt(v))}</text>`); });
    y += h + 10;
  });
  const ox = fx + fw + 70; let oy = 10, maxW = 0;
  refs.forEach(r => { const o = s.h[r]; const label = o.t === "obj" ? o.c + " object" : o.t;
    if (o.t === "val") {
      const w = Math.max(56, o.v.length * CW + 20);
      parts.push(`<text x="${ox}" y="${oy + 11}" font-family="var(--ui)" font-size="11" letter-spacing="1.5" fill="var(--violet)">${esc(o.c.toUpperCase())}</text><rect x="${ox}" y="${oy + 16}" width="${w}" height="26" rx="4" fill="rgba(180,155,255,.08)" stroke="var(--violet)"/><text x="${ox + w / 2}" y="${oy + 34}" text-anchor="middle" font-family="var(--mono)" font-size="13" fill="var(--text)">${esc(o.v)}</text>`);
      boxes[r] = { x: ox, y: oy + 29 }; maxW = Math.max(maxW, w); oy += 52; return;
    }
    if (o.t === "list" || o.t === "tuple" || o.t === "set") {
      const cells = o.v.map(e => Math.max(28, cellTxt(e).length * CW + 14)); const w = Math.max(60, cells.reduce((a, b) => a + b, 0)); let cx = ox;
      parts.push(`<text x="${ox}" y="${oy + 11}" font-family="var(--ui)" font-size="11" letter-spacing="1.5" fill="var(--violet)">${label.toUpperCase()}</text>`);
      o.v.forEach((e, j) => { parts.push(`<rect x="${cx}" y="${oy + 16}" width="${cells[j]}" height="26" fill="rgba(180,155,255,.08)" stroke="var(--violet)"/>${o.t !== "set" ? `<text x="${cx + cells[j] / 2}" y="${oy + 54}" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="var(--faint)">${j}</text>` : ""}`);
        if (e[0] === "r") dots.push({ x: cx + cells[j] / 2, y: oy + 29, to: e[1] }); else parts.push(`<text x="${cx + cells[j] / 2}" y="${oy + 34}" text-anchor="middle" font-family="var(--mono)" font-size="13" fill="var(--text)">${esc(cellTxt(e))}</text>`);
        cx += cells[j]; });
      if (!o.v.length) parts.push(`<rect x="${ox}" y="${oy + 16}" width="40" height="26" fill="none" stroke="var(--violet)" stroke-dasharray="3 3"/>`);
      boxes[r] = { x: ox, y: oy + 29 }; maxW = Math.max(maxW, w); oy += 70;
    } else {
      const rows = o.v.map(([a, b]) => [o.t === "dict" ? show(a, s.h) : a, b]);
      const w = Math.max(120, ...rows.map(([a, b]) => (String(a).length + cellTxt(b).length) * CW + 44)); const h = 22 + Math.max(1, rows.length) * RH;
      parts.push(`<rect x="${ox}" y="${oy}" width="${w}" height="${h}" rx="4" fill="rgba(180,155,255,.08)" stroke="var(--violet)"/><text x="${ox + P}" y="${oy + 15}" font-family="var(--ui)" font-size="11" letter-spacing="1.5" fill="var(--violet)">${esc(label.toUpperCase())}</text>`);
      rows.forEach(([a, b], j) => { const ty = oy + 22 + j * RH + 15; parts.push(`<text x="${ox + P}" y="${ty}" font-family="var(--mono)" font-size="13" fill="var(--muted)">${esc(a)}</text>`);
        if (b[0] === "r") dots.push({ x: ox + w - 14, y: ty - 4, to: b[1] }); else parts.push(`<text x="${ox + w - P}" y="${ty}" text-anchor="end" font-family="var(--mono)" font-size="13" fill="var(--text)">${esc(cellTxt(b))}</text>`); });
      boxes[r] = { x: ox, y: oy + 11 }; maxW = Math.max(maxW, w); oy += h + 14;
    }
  });
  dots.forEach(d => { const b = boxes[d.to]; if (!b) return; const mx = Math.max(d.x + 24, b.x - 30);
    parts.push(`<circle cx="${d.x}" cy="${d.y}" r="3.5" fill="var(--violet)"/><path d="M${d.x} ${d.y} C${mx} ${d.y}, ${b.x - 30} ${b.y}, ${b.x - 6} ${b.y}" fill="none" stroke="var(--violet)" stroke-width="1.6"/><path d="M${b.x - 6} ${b.y - 4} L${b.x} ${b.y} L${b.x - 6} ${b.y + 4}" fill="var(--violet)"/>`); });
  const vw = Math.max(320, ox + maxW + 10), vh = Math.max(y, oy) + 4;
  return `<svg viewBox="0 0 ${vw} ${vh}" style="max-width:${vw}px" role="img" aria-label="memory diagram">${parts.join("")}</svg>`;
}

// Array view: bars for a list of numbers; marks {i: "c2"} colour the index held in variable i.
function barsSVG(T, i, name, marks = {}){
  const a = nums(T, i, name); if (!a) return `<p class="narr" style="padding:0 10px">${esc(name)} does not exist yet.</p>`;
  const s = stepAt(T, i), at = {}; for (const [v, c] of Object.entries(marks)) { const fr = s.f.slice().reverse().find(f => v in f.vars); const x = fr && fr.vars[v]; if (x && x[0] === "v" && /^-?\d+$/.test(x[1])) at[+x[1]] = (at[+x[1]] ? at[+x[1]] + " " : "") + c + ":" + v; }
  const mx = Math.max(1, ...a.map(Math.abs)), bw = 34, gap = 8, H = 120, vw = Math.max(240, a.length * (bw + gap) + 20);
  const col = { c1: "var(--amber)", c2: "var(--cyan)", c3: "var(--pink)", c4: "var(--violet)", c5: "var(--green)" };
  const bars = a.map((v, j) => { const h = Math.max(2, Math.abs(v) / mx * H), x = 10 + j * (bw + gap), m = at[j] ? at[j].split(" ").map(t => t.split(":")) : [];
    const fill = m.length ? col[m[0][0]] : "rgba(180,155,255,.35)";
    return `<rect x="${x}" y="${20 + H - h}" width="${bw}" height="${h}" rx="2" fill="${fill}"/><text x="${x + bw / 2}" y="${14 + H - h}" text-anchor="middle" font-family="var(--mono)" font-size="12" fill="var(--text)">${v}</text><text x="${x + bw / 2}" y="${36 + H}" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="var(--faint)">${j}</text>`
      + m.map(([c, nm], q) => `<text x="${x + bw / 2}" y="${52 + H + q * 14}" text-anchor="middle" font-family="var(--mono)" font-size="12" fill="${col[c]}">${esc(nm)}</text>`).join(""); }).join("");
  return `<svg viewBox="0 0 ${vw} ${H + 84}" style="max-width:${vw}px" role="img" aria-label="${esc(name)} as bars">${bars}</svg>`;
}

function attach(k){
  css();
  if (!k.guard) k.guard = list => { k.stage.dataset.answers = JSON.stringify(list || []); };
  k.CR = CR;
  k.csro = o => k.setRO(`<div>${o.title ? `<h2>${o.title}</h2>` : ""}${o.big ? `<div class="ro-big" style="margin-top:8px">${o.big}</div>` : ""}</div>`
    + (o.rows && o.rows.length ? `<div class="ro-rows">${o.rows.filter(Boolean).map(r => `<div class="row"><span>${r.label}</span> <span class="v ${r.c || ""}">${r.value}</span>${r.note ? `<span class="lbl">${r.note}</span>` : ""}</div>`).join("")}</div>` : "")
    + (o.landmark ? `<div class="landmark${o.landmark.hit ? " hit" : ""}"><div class="big">${o.landmark.big || ""}</div>${o.landmark.note ? `<div class="note">${o.landmark.note}</div>` : ""}</div>` : "")
    + (o.narr ? `<p class="narr">${o.narr}</p>` : ""));
  /* k.csModes([["trace","Trace"], …], key => { …build that mode…; return obj with pause() if it plays }, active?)
     Switching modes stops playback, clears the controls and the stage (except the mode buttons) and the guard. */
  k.csModes = (list, build, active) => { let cur = null; const first = active || list[0][0];
    const run = key => { if (cur && cur.pause) cur.pause(); k.ctl.innerHTML = ""; [...k.stage.children].forEach(el => { if (!el.classList.contains("modes")) el.remove(); }); delete k.stage.dataset.answers; cur = build(key) || null; };
    const bar = k.modes(list, first, run);
    // keep the panes below the mode buttons even when they wrap onto two rows (phones, long labels)
    const pad = () => { const d = k.stage.querySelector(".dom.cs"); if (d && bar.offsetHeight) d.style.paddingTop = Math.max(54, bar.offsetTop + bar.offsetHeight + 10) + "px"; };
    const run0 = run; const runP = key => { run0(key); pad(); };
    bar.querySelectorAll("button").forEach(b => { const f = b.onclick; b.onclick = e => { f.call(b, e); pad(); }; });
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(pad).observe(bar);
    runP(first); };
  const get = key => { const T = W.CSTraces && W.CSTraces[key]; if (!T) throw new Error(`CSKit: no trace "${key}" (run python3 tools/pytrace.py ${key.split("/")[0]})`); return T; };

  /* k.trace(cfg): code + state + output with Back / Step / Play / Reset.
     cfg: { host?: element (default k.dom()), programs: [["id/name", "Label"], …], view: "vars" | "memory" | "bars" | "vars+bars",
            bars: { name: "xs", marks: { i: "c2", j: "c3" } }, title, narr(step, i, T, key) → html | { "id/name": { line: html } },
            rows(step, i, T) → extra readout rows, onStep(i, T) } → { go(i), get i(), get T, select(key) } */
  k.trace = cfg => {
    const dom = cfg.host || k.dom(); dom.className = "dom cs"; let key = cfg.programs[0][0], T = get(key), i = 0, stop = null;
    const view = cfg.view || "vars";
    if (cfg.programs.length > 1) k.select("Program", cfg.programs, key, v => { key = v; T = get(v); i = 0; build(); draw(); });
    const bBack = k.button("Back", () => { pause(); go(i - 1); }, "btn ghost"), bStep = k.button("Step", () => { pause(); go(i + 1); });
    const bPlay = k.button("Play", () => (stop ? pause() : play()), "btn ghost"); k.button("Reset", () => { pause(); go(0); }, "btn ghost");
    function play(){ if (i >= T.steps.length - 1) go(0); bPlay.textContent = "Pause"; stop = k.every(k.reduce ? 1400 : 900, () => (i >= T.steps.length - 1 ? pause() : go(i + 1))); }
    function pause(){ if (stop) stop(); stop = null; bPlay.textContent = "Play"; }
    let codeEl, stateEl, outEl, prevLine = 0;
    function build(){
      dom.innerHTML = `<div class="pane"><h3>Program</h3><div class="cs-code">${codeHTML(T.code)}</div></div>
        <div class="pane"><h3>${view === "memory" ? "Frames and objects" : view === "bars" ? "List" : "Variables"}</h3><div class="cs-state"></div></div>
        <div class="pane cs-out"><h3>Output</h3><pre></pre></div>`;
      codeEl = dom.querySelector(".cs-code"); stateEl = dom.querySelector(".cs-state"); outEl = dom.querySelector(".cs-out pre");
    }
    function go(n){ const last = T.steps.length - 1; n = Math.max(0, Math.min(last, n)); prevLine = n > 0 ? stepAt(T, n - 1).l : 0; i = n; draw(); }
    function draw(){
      const s = stepAt(T, i), last = T.steps.length - 1;
      codeEl.querySelectorAll(".ln").forEach((el, j) => { el.classList.toggle("cur", j + 1 === s.l); el.classList.toggle("prev", j + 1 === prevLine && j + 1 !== s.l); });
      const cur = codeEl.querySelector(".ln.cur"); if (cur && cur.scrollIntoView && codeEl.parentNode.scrollHeight > codeEl.parentNode.clientHeight) cur.scrollIntoView({ block: "nearest" });
      stateEl.innerHTML = view === "memory" ? memorySVG(T, i) : view === "bars" ? barsSVG(T, i, cfg.bars.name, cfg.bars.marks)
        : view === "vars+bars" ? `<div class="cs-vars">${varsHTML(T, i)}</div>${barsSVG(T, i, cfg.bars.name, cfg.bars.marks)}` : `<div class="cs-vars">${varsHTML(T, i)}</div>`;
      if (view === "vars") stateEl.firstChild.className = "cs-vars";
      outEl.innerHTML = esc(outAt(T, i)) + (s.ev === "end" && T.error ? `<span class="err">${esc(T.error)}</span>` : "");
      bBack.disabled = i === 0; bStep.disabled = i === last;
      const ch = [...changed(T, i)].map(x => x.split(":")[1]);
      const nar = typeof cfg.narr === "function" ? cfg.narr(s, i, T, key) : cfg.narr && cfg.narr[key] ? cfg.narr[key][s.ev === "end" ? "end" : s.l] : "";
      k.csro({ title: cfg.title || "Trace", big: `<span class="m">step ${i} of ${last}</span>`,
        rows: [{ label: "Now", value: esc(evText(T, i)), c: s.ev === "return" ? "c5" : "c1" }, ch.length ? { label: "Changed", value: esc(ch.join(", ")), c: "c2" } : null,
          { label: "Frames", value: String(s.f.length), note: s.f.length > 1 ? "call stack depth" : "" }, ...(cfg.rows ? cfg.rows(s, i, T) || [] : [])],
        narr: nar || (i === 0 ? "Press Step to run one line at a time. The amber line has not run yet." : "") });
      if (cfg.onStep) cfg.onStep(i, T);
    }
    build(); draw();
    return { go, get i(){ return i; }, get T(){ return T; }, get key(){ return key; }, pause };
  };

  /* k.predict(cfg): show a program, the learner picks its output, then sees the real output.
     cfg: { host?, items: [{ key: "id/name", choices: ["…", …], why: html }] }  (the real output is added to the choices
     automatically and shuffled; choices must be the plausible mistakes). No k.guard: the right answer is one of the buttons by design. */
  k.predict = cfg => {
    const dom = cfg.host || k.dom(); dom.className = "dom cs one"; let n = 0, picked = null; const score = { right: 0, tries: 0 };
    const real = it => get(it.key).out.replace(/\n$/, "") + (get(it.key).error ? (get(it.key).out ? "\n" : "") + get(it.key).error : "");
    const order = cfg.items.map(it => shuffle([...new Set([real(it), ...it.choices])]));
    k.button("Next program", () => { n = (n + 1) % cfg.items.length; picked = null; draw(); });
    function draw(){
      const it = cfg.items[n], T = get(it.key), ans = real(it);
      dom.innerHTML = `<div class="pane"><h3>Program ${n + 1} of ${cfg.items.length}${T.input.length ? ` · input: ${esc(T.input.join(", "))}` : ""}</h3><div class="cs-code">${codeHTML(T.code)}</div></div>
        <div class="pane"><h3>What does it print?</h3><div class="cs-pick">${order[n].map((c, j) => `<button type="button" data-j="${j}" class="${picked == null ? "" : c === ans ? "right" : j === picked ? "wrong" : ""}">${esc(c || "(nothing)")}</button>`).join("")}</div></div>`;
      dom.querySelectorAll(".cs-pick button").forEach(b => b.onclick = () => { if (picked != null) return; picked = +b.dataset.j; score.tries++; if (order[n][picked] === ans) score.right++; draw(); });
      const done = picked != null, ok = done && order[n][picked] === ans;
      k.csro({ title: "Predict the output", big: `<span class="m">${score.right} / ${score.tries}</span>`,
        rows: [{ label: "Program", value: `${n + 1} of ${cfg.items.length}` }, done ? { label: "Python printed", value: `<span style="white-space:pre-wrap">${esc(ans || "(nothing)")}</span>`, c: "c3" } : null],
        landmark: done ? { big: ok ? "Correct" : "Not quite", hit: ok } : null, narr: done ? it.why : "Trace it in your head line by line, then pick." });
    }
    draw();
  };

  /* k.bits(cfg): a row of bits to toggle. cfg: { host?, width: 8, signed: false, value: 0, extra(v, bits) → readout rows } */
  k.bits = cfg => {
    const dom = cfg.host || k.dom(); dom.className = "dom cs one"; const w = cfg.width || 8; let bits = (cfg.signed ? twos(cfg.value || 0, w) : toBase(cfg.value || 0, 2, w)).split("");
    function draw(){
      const s = bits.join(""), u = fromBase(s, 2), v = cfg.signed ? fromTwos(s) : u;
      dom.innerHTML = `<div class="pane"><h3>${w} bits${cfg.signed ? " · two's complement" : ""}</h3><div class="cs-bits">${bits.map((b, j) => `<button type="button" data-j="${j}" class="${b === "1" ? "on" : ""}" aria-pressed="${b === "1"}">${b}<small>${cfg.signed && j === 0 ? "−" : ""}${2 ** (w - 1 - j)}</small></button>`).join("")}</div></div>`;
      dom.querySelectorAll(".cs-bits button").forEach(b => b.onclick = () => { const j = +b.dataset.j; bits[j] = bits[j] === "1" ? "0" : "1"; draw(); });
      k.csro({ title: "Bits", big: `<span class="m c1">${v}</span>`, rows: [{ label: "binary", value: s, c: "c4" }, { label: "hex", value: "0x" + toBase(u, 16, Math.ceil(w / 4)), c: "c2" },
        cfg.signed ? { label: "unsigned", value: String(u) } : null, ...(cfg.extra ? cfg.extra(v, s) || [] : [])] });
    }
    draw();
    return { set(n){ bits = (cfg.signed ? twos(n, w) : toBase(n, 2, w)).split(""); draw(); } };
  };
  return k;
}

W.CSKit = { attach, memorySVG, barsSVG, varsHTML, codeHTML };
})();
