/* ============ Universal lab kit: what every lab in every subject uses ============
   Loaded first (build-web: web/kits/universal → categorical → subjects → labs). window.LabKit:
     LabKit.make(stage, ro, ctl) → k      the kit a lab receives (L["id"] = k => {…})
     LabKit.stopAll()                     stops loops, observers and timers when a page closes
     LabKit.extend(fn)                    a categorical kit adds its helpers: fn(k) runs at the end of every make()
     LabKit.rules                         DOM-free helpers (tested in tests/universal.test.js): fmt, gcd, lcm, shuffle,
                                          clamp, snap, decimals, parseNum, scrubValue, numText
   k (every lab): C (colours), F (fonts), alpha, reduce, fmt, gcd, lcm, shuffle, M, neg, frac, words; stage, ro, ctl;
     k.canvas() → c, k.dom(), k.loop(fn), k.every(ms, fn), k.fontsReady(cb), k.setRO(html), k.css(id, text)
     controls: k.slider, k.number, k.select, k.button, k.check, k.modes, k.params, k.group/k.showGroup
     layout:   k.split(c, host, o), k.hint(text) (one at a time), k.smooth(cur, target, dt)
     output:   k.readout({title, big, rows, landmark, narr}), k.guard([answers])
     numbers you can change: S = k.vars(defs, onChange), S.html(key), k.eqline(html)   (see below)
   Categorical kits (web/kits/categorical) add: k.plot/k.plane/k.cplane/k.drag (plane.js), k.stepper/k.stepsPanel
   (stepper.js), LabKit.quiz (quiz.js). Subject kits (web/kits/subjects) add DOM-free rules and subject drawing. */
(function(){
const W = typeof window !== "undefined" ? window : globalThis;
const MI = "−";

/* ---------------- DOM-free rules ---------------- */
const fmt = (v, d = 3) => { if (!isFinite(v)) return "undefined"; const s = (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d }); return s.replace("-", MI); };
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const lcm = (a, b) => a && b ? Math.abs(a * b) / gcd(a, b) : 0;
// Copy of arr, shuffled; seeded (repeatable, for tests) when seed is given.
const shuffle = (arr, seed) => {
  const a = arr.slice(); let s = seed == null ? Math.random() * 1e9 : seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((seed == null ? Math.random() : rnd()) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const clamp = (v, lo = -Infinity, hi = Infinity) => Math.max(lo, Math.min(hi, v));
// Number of decimals a step needs (0.25 → 2, 1 → 0, π/12 → 6)
const decimals = step => { if (!step || !isFinite(step)) return 6; for (let d = 0; d <= 6; d++) if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-9) return d; return 6; };
// Nearest multiple of step from origin, cleaned of float dust (0.1 + 0.2 → 0.3)
const snap = (v, step, origin = 0) => { if (!step) return v; const n = Math.round((v - origin) / step); return +(origin + n * step).toFixed(Math.max(decimals(step), decimals(origin))); };
// Typed number → value or null. Accepts −/-, decimals, fractions (3/4, −5/2), mixed (1 1/2), π forms (π, 2π, π/3, −3π/4, 2pi), √n, a√n, %.
function parseNum(str){
  if (str == null) return null;
  let s = String(str).trim().toLowerCase().replace(/[−–—]/g, "-").replace(/\s+/g, " ").replace(/pi/g, "π").replace(/sqrt\s*/g, "√").replace(/,/g, "");
  if (!s) return null;
  let sign = 1; if (s[0] === "+") s = s.slice(1).trim(); else if (s[0] === "-") { sign = -1; s = s.slice(1).trim(); }
  let m;
  if ((m = /^(\d+) (\d+)\/(\d+)$/.exec(s))) { const d = +m[3]; return d ? sign * (+m[1] + +m[2] / d) : null; }
  if ((m = /^(\d*\.?\d*)%$/.exec(s)) && m[1] !== "" && m[1] !== ".") return sign * (+m[1] / 100);
  const atom = t => {
    t = t.trim(); let q;
    if ((q = /^(\d*\.?\d*)\s*π$/.exec(t))) return (q[1] === "" ? 1 : q[1] === "." ? NaN : +q[1]) * Math.PI;
    if ((q = /^(\d*\.?\d*)\s*√\s*(\d*\.?\d+)$/.exec(t))) return (q[1] === "" ? 1 : +q[1]) * Math.sqrt(+q[2]);
    if (/^(\d+\.?\d*|\.\d+)(e-?\d+)?$/.test(t)) return +t;
    return NaN;
  };
  const parts = s.split("/");
  if (parts.length > 2) return null;
  const top = atom(parts[0]), bot = parts.length === 2 ? atom(parts[1]) : 1;
  if (!isFinite(top) || !isFinite(bot) || bot === 0) return null;
  return sign * top / bot;
}
// Scrubbing: the value after dragging dx px from v0 (pxPerStep px per step), snapped and clamped.
const scrubValue = (v0, dx, o = {}) => { const step = o.step || 1, px = o.px || 6; return clamp(snap(v0 + Math.round(dx / px) * step, step, o.origin || 0), o.min ?? -Infinity, o.max ?? Infinity); };
// Plain text of a number for a scrubbable value: U+2212 minus, no float dust, at most `d` decimals.
const numText = (v, d = 4) => { if (!isFinite(v)) return "undefined"; const s = String(+v.toFixed(d)); return (s === "-0" ? "0" : s).replace("-", MI); };
const rules = { fmt, gcd, lcm, shuffle, clamp, decimals, snap, parseNum, scrubValue, numText };

if (typeof document === "undefined") { W.LabKit = Object.assign(W.LabKit || {}, { rules, extend(){} }); return; }

/* ---------------- shared look ---------------- */
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = {};
["amber","cyan","pink","violet","green","red","text","muted","faint","line","line-2","panel","panel-2","panel-3","ink"].forEach(k => C[k.replace("-","")] = css("--" + k) || "#fff");
const F = {
  math: '"STIX Two Text", "Cambria Math", Georgia, serif',
  mono: '"IBM Plex Mono", ui-monospace, Menlo, monospace',
  ui: '"Saira Semi Condensed", "Arial Narrow", sans-serif',
  sans: '"IBM Plex Sans", system-ui, sans-serif'
};
const alpha = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; };
const reduce = W.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = W.matchMedia && W.matchMedia("(pointer: coarse)").matches;
let uid = 0;
const live = { loops: new Set(), ros: new Set(), timers: new Set(), offs: new Set(), values: {}, auto: {} };
const exts = [];
const addCSS = (id, text) => { if (document.getElementById(id)) return; const s = document.createElement("style"); s.id = id; s.textContent = text; document.head.appendChild(s); };

addCSS("uk-css", `.kv{display:inline-block;cursor:ew-resize;border-bottom:1.5px dashed currentColor;border-radius:3px;padding:0 2px;margin:0 1px;touch-action:none;user-select:none;-webkit-user-select:none;transition:background .12s;font-variant-numeric:tabular-nums}
.kv:hover,.kv.on{background:rgba(255,255,255,.09)}
.kv:focus-visible{outline:2px solid var(--frame,#5CC8E0);outline-offset:1px}
.kv.min,.kv.max{border-bottom-style:solid}
body.kv-scrubbing,body.kv-scrubbing *{cursor:ew-resize!important;user-select:none!important}
.kv-edit{position:fixed;z-index:9999;font:inherit;color:var(--text);background:var(--panel-2,#111);border:1px solid var(--frame,#5CC8E0);border-radius:4px;padding:1px 6px;outline:none;box-shadow:0 4px 18px rgba(0,0,0,.45);text-align:center}
.kv-edit.bad{border-color:var(--red,#e55);animation:kv-bad .3s}
@keyframes kv-bad{25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
.ctl.eqline{flex:1 1 100%;justify-content:center;font:400 21px/1.5 var(--math);color:var(--text);flex-wrap:wrap;gap:0 6px;min-height:34px}
.ctl.eqline .eqtag{font:600 11px/1.2 var(--ui);letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin-right:8px}
.stage canvas:focus-visible{outline:2px solid var(--frame,#5CC8E0);outline-offset:-2px}
@media (max-width:560px){.ctl.eqline{font-size:18px}}`);

function D(g){
  return {
    text(s, x, y, o = {}){ g.font = o.font || `16px ${F.math}`; g.fillStyle = o.color || C.text; g.textAlign = o.align || "left"; g.textBaseline = o.base || "alphabetic"; g.fillText(s, x, y); return g.measureText(s).width; },
    width(s, font){ g.font = font; return g.measureText(s).width; },
    line(x1, y1, x2, y2, color = C.line2, w = 1, dash){ g.save(); g.strokeStyle = color; g.lineWidth = w; if (dash) g.setLineDash(dash); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.restore(); },
    rect(x, y, w, h, fill, stroke, lw = 1){ if (fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.strokeRect(x + .5, y + .5, w - 1, h - 1); } },
    rr(x, y, w, h, r, fill, stroke, lw = 1){ g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } },
    circle(x, y, r, fill, stroke, lw = 1){ g.beginPath(); g.arc(x, y, Math.max(0, r), 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } },
    hop(x1, x2, y, hgt, color, w = 2){ g.save(); g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y); g.quadraticCurveTo((x1 + x2) / 2, y - hgt, x2, y); g.stroke();
      const ang = Math.atan2(y - (y - hgt), x2 - (x1 + x2) / 2); g.fillStyle = color; g.beginPath(); g.moveTo(x2, y); g.lineTo(x2 - 8 * Math.cos(ang - .4), y - 8 * Math.sin(ang - .4)); g.lineTo(x2 - 8 * Math.cos(ang + .4), y - 8 * Math.sin(ang + .4)); g.closePath(); g.fill(); g.restore(); },
    arrow(x1, y1, x2, y2, color, w = 2){ g.save(); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); const a = Math.atan2(y2 - y1, x2 - x1); g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - 9 * Math.cos(a - .45), y2 - 9 * Math.sin(a - .45)); g.lineTo(x2 - 9 * Math.cos(a + .45), y2 - 9 * Math.sin(a + .45)); g.closePath(); g.fill(); g.restore(); },
    pow(base, exp, x, y, o = {}){ const size = o.size || 16; const f = `${size}px ${o.family || F.math}`; const w1 = this.text(base, x, y, { font: f, color: o.color, align: "left", base: o.base }); const w2 = this.text(exp, x + w1 + 1, y - size * .42, { font: `${Math.round(size * .66)}px ${o.family || F.math}`, color: o.ecolor || o.color, align: "left", base: o.base }); return w1 + w2 + 1; },
    powW(base, exp, size, family){ return this.width(base, `${size}px ${family || F.math}`) + this.width(exp, `${Math.round(size*.66)}px ${family || F.math}`) + 1; }
  };
}

const M = s => `<span class="m">${s}</span>`;
const neg = n => (n < 0 ? MI + Math.abs(n) : String(n));
const frac = (n, d, cls = "") => `<span class="m ${cls}"><span class="fr"><span>${n}</span><span>${d}</span></span></span>`;
function words(n){
  if (n === 0) return "zero";
  const a = ["","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
  const t = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
  const two = x => x < 20 ? a[x] : t[Math.floor(x / 10)] + (x % 10 ? "-" + a[x % 10] : "");
  const three = x => (x >= 100 ? a[Math.floor(x / 100)] + " hundred" + (x % 100 ? " " : "") : "") + (x % 100 ? two(x % 100) : "");
  const parts = []; const units = ["", " thousand", " million", " billion"]; let i = 0;
  while (n > 0) { const c = n % 1000; if (c) parts.unshift(three(c) + units[i]); n = Math.floor(n / 1000); i++; }
  return parts.join(" ");
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function make(stage, ro, ctl){
  const kit = { C, F, alpha, reduce, coarse, fmt, gcd, lcm, shuffle, M, neg, frac, words, esc, stage, ro, ctl, rules };
  const listen = (el, type, fn, opt) => { el.addEventListener(type, fn, opt); live.offs.add(() => el.removeEventListener(type, fn, opt)); };
  kit.listen = listen;
  let lastRO = "";
  kit.setRO = html => { if (html !== lastRO) { ro.innerHTML = html; lastRO = html; } };
  kit.css = addCSS;
  kit.canvas = () => {
    const cv = document.createElement("canvas"); stage.appendChild(cv);
    const g = cv.getContext("2d"); const o = { cv, g, w: 1, h: 1, dpr: 1, d: D(g) };
    const rs = () => { const r = stage.getBoundingClientRect(); o.w = Math.max(1, r.width); o.h = Math.max(1, r.height); o.dpr = Math.min(W.devicePixelRatio || 1, 2); cv.width = Math.round(o.w * o.dpr); cv.height = Math.round(o.h * o.dpr); };
    const obs = new ResizeObserver(rs); obs.observe(stage); live.ros.add(obs); rs();
    o.begin = () => { g.setTransform(o.dpr, 0, 0, o.dpr, 0, 0); g.clearRect(0, 0, o.w, o.h); };
    o.xy = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    return o;
  };
  kit.dom = () => { const d = document.createElement("div"); d.className = "dom"; stage.appendChild(d); return d; };
  kit.loop = fn => { const L = { on: true }; live.loops.add(L); let last = performance.now(); const f = now => { if (!L.on) return; const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; try { fn(dt, now / 1000); } catch(e) { console.error(e); L.on = false; return; } requestAnimationFrame(f); }; requestAnimationFrame(f); };
  kit.every = (ms, fn) => { const id = setInterval(fn, ms); live.timers.add(id); return () => { clearInterval(id); live.timers.delete(id); }; };
  // One hint at a time: k.hint(text) replaces the previous hint ("" removes it).
  kit.hint = t => { stage.querySelectorAll(".hintc").forEach(e => e.remove()); if (t) { const e = document.createElement("div"); e.className = "hintc"; e.textContent = t; stage.appendChild(e); } };
  // Declare the current mode's answers (strings as they would appear, e.g. "x = 3"); tools/layoutcheck.js reports any
  // of them visible when the mode opens. Call again with [] or new answers when the mode changes.
  kit.guard = list => { stage.dataset.answers = JSON.stringify(list || []); };
  // Let the page drive this lab: k.expose({ set: v => …, play: () => … }). Concept-tab "Try it" chips call
  // LabKit.drive("set:19,play") (comma-separated, name[:argument]); see docs/subjects/LAYERS.md.
  kit.expose = actions => { live.expose = actions; };
  // Every control also drives itself (1.18.5): a chip may name a control by its key, the first word of its label
  // ("<i>a</i>" → a, "Round to" → round, "Next pair" → nextpair for buttons; a repeated key gets 2, 3 …), and the
  // control publishes its value under that key. slider/number: "a:7" (the raw slider value); select: "op:1" (option
  // index); check: "log:1" / "log:0" / "log" (toggle); button: "nextpair"; k.modes: "mode:2" (button index).
  // Commands the lab exposes itself (k.expose) win over these.
  const autoKey = (label, button) => { let t = String(label).replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/g, " ").toLowerCase();
    t = button ? t.replace(/[^a-z]+/g, "") : (t.replace(/[^a-z0-9]+/g, " ").trim().split(" ")[0] || "");
    if (!/^[a-z]/.test(t)) return ""; let k = t, i = 2; while (live.auto[k] && live.auto[k].el && live.auto[k].el.isConnected) k = t + i++; return k; };   // a control rebuilt for another mode keeps its key
  const autoCtl = (key, fn, v, el) => { if (!key) return; fn.el = el; live.auto[key] = fn; if (v !== undefined) kit.publish(key, v); };
  // Tell the page a live value: k.publish("n", 17). The Concept tab's question figure ({echo: "n"}) follows it;
  // fires "inquire:lab-value" {key, value} only when the value changes; LabKit.value(key) reads the latest.
  kit.publish = (key, v) => { if (live.values[key] === v) return; live.values[key] = v; window.dispatchEvent(new CustomEvent("inquire:lab-value", { detail: { key, value: v } })); };

  kit.slider = (label, min, max, step, value, onInput, fmtFn) => {
    const id = "lab" + (++uid);
    const w = document.createElement("div"); w.className = "ctl grow";
    w.innerHTML = `<label for="${id}">${label}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"><span class="val"></span>`;
    kit.ctl.appendChild(w);
    const inp = w.querySelector("input"), val = w.querySelector(".val");
    const show = () => { val.textContent = fmtFn ? fmtFn(+inp.value) : String(inp.value).replace("-", MI); };
    inp.addEventListener("input", () => { show(); onInput(+inp.value); kit.publish(sk, +inp.value); }); show();
    const sk = autoKey(label); autoCtl(sk, v => { inp.value = v; inp.dispatchEvent(new Event("input")); }, +inp.value, inp);
    return { el: inp, get v(){ return +inp.value; }, set(v){ inp.value = v; show(); kit.publish(sk, +inp.value); }, setMax(m){ inp.max = m; if (+inp.value > m) { inp.value = m; } show(); }, setMin(m){ inp.min = m; if (+inp.value < m) inp.value = m; show(); } };
  };
  kit.number = (label, min, max, value, onChange, width) => {
    const id = "lab" + (++uid);
    const w = document.createElement("div"); w.className = "ctl";
    w.innerHTML = `<label for="${id}">${label}</label><input type="number" id="${id}" min="${min}" max="${max}" value="${value}">`;
    kit.ctl.appendChild(w);
    const inp = w.querySelector("input"); if (width) inp.style.width = width;
    const read = () => { let v = Math.round(+inp.value); if (!isFinite(v)) v = value; v = Math.max(min, Math.min(max, v)); return v; };
    inp.addEventListener("change", () => { const v = read(); inp.value = v; onChange(v); kit.publish(nk, v); });
    const nk = autoKey(label); autoCtl(nk, v => { inp.value = v; inp.dispatchEvent(new Event("change")); }, read(), inp);
    return { el: inp, get v(){ return read(); }, set(v){ inp.value = v; kit.publish(nk, read()); } };
  };
  kit.select = (label, options, value, onChange) => {
    const id = "lab" + (++uid);
    const w = document.createElement("div"); w.className = "ctl";
    w.innerHTML = `<label for="${id}">${label}</label><select id="${id}">${options.map(([v, t]) => `<option value="${v}"${String(v) === String(value) ? " selected" : ""}>${t}</option>`).join("")}</select>`;
    kit.ctl.appendChild(w);
    const s = w.querySelector("select"); s.addEventListener("change", () => { onChange(s.value); kit.publish(qk, s.selectedIndex); });
    const qk = autoKey(label); autoCtl(qk, v => { s.selectedIndex = Math.max(0, Math.min(s.options.length - 1, Math.round(+v) || 0)); s.dispatchEvent(new Event("change")); }, s.selectedIndex, s);
    return { el: s, get v(){ return s.value; }, set(v){ s.value = v; kit.publish(qk, s.selectedIndex); } };
  };
  kit.button = (label, onClick, cls = "btn") => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = label; b.addEventListener("click", onClick); kit.ctl.appendChild(b); autoCtl(autoKey(label, true), () => b.click(), undefined, b); return b; };
  kit.check = (label, value, onChange) => {
    const id = "lab" + (++uid);
    const w = document.createElement("div"); w.className = "ctl";
    w.innerHTML = `<input type="checkbox" id="${id}"${value ? " checked" : ""}><label for="${id}" style="font-family:var(--sans)">${label}</label>`;
    kit.ctl.appendChild(w); const c = w.querySelector("input"); c.addEventListener("change", () => { onChange(c.checked); kit.publish(ck, c.checked ? 1 : 0); });
    const ck = autoKey(label); autoCtl(ck, v => { c.checked = v === "" ? !c.checked : !!+v; c.dispatchEvent(new Event("change")); }, c.checked ? 1 : 0, c); return c;
  };
  kit.modes = (list, active, onPick) => {
    const w = document.createElement("div"); w.className = "modes"; w.setAttribute("role", "group");
    list.forEach(([k, t]) => { const b = document.createElement("button"); b.type = "button"; b.textContent = t; b.dataset.k = k; b.setAttribute("aria-pressed", String(k === active)); b.onclick = () => { w.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); onPick(k); }; w.appendChild(b); });
    stage.appendChild(w); const bs = [...w.querySelectorAll("button")];
    autoCtl(live.auto.mode ? "" : "mode", v => { const b = bs[Math.max(0, Math.min(bs.length - 1, Math.round(+v) || 0))]; if (b) b.click(); }, Math.max(0, list.findIndex(x => x[0] === active)));
    bs.forEach((b, i) => b.addEventListener("click", () => kit.publish("mode", i)));
    return w;
  };

  // Controls per mode: k.group("graph", () => { k.slider(…); … }) records the controls that block adds;
  // k.showGroup("graph") shows only that group's controls (controls made outside any group always show).
  const groups = {};
  kit.group = (name, fn) => { const before = new Set(kit.ctl.children); const r = fn(); (groups[name] = groups[name] || []).push(...[...kit.ctl.children].filter(e => !before.has(e))); return r; };
  kit.showGroup = name => { for (const [g, els] of Object.entries(groups)) els.forEach(e => { e.style.display = g === name ? "" : "none"; }); };

  // Split the stage between a DOM panel (steps, tables) and the canvas plot, below the mode buttons.
  // Wide (≥ minWide px): panel on the `side` ("left" | "right", width frac); narrow: panel on top (height hfrac).
  // Returns the plot padding {l, r, t, b} for k.plane({pad}); o.full → panel takes the whole stage (returns null);
  // o.off → hides the panel and returns default padding. Call every frame (cheap: only restyles on change).
  kit.split = (c, host, o = {}) => {
    const mb = stage.querySelector(".modes"), top = mb ? mb.offsetTop + mb.offsetHeight + 4 : 8, set = css => { if (host.__css !== css) { host.style.cssText = css; host.__css = css; } };
    if (o.off) { set("display:none"); return { l: 40, r: 16, t: 16, b: 30 }; }
    const wide = c.w >= (o.minWide || 600); host.classList.toggle("narrow", !wide);
    if (o.full) { set(`display:block;left:0;right:0;top:${top}px;bottom:0;width:auto;height:auto;padding:0;overflow:auto`); return null; }
    if (wide) { const dw = Math.round(c.w * (o.frac || .46)), left = o.side !== "right";
      set(`display:block;top:${top}px;bottom:0;${left ? "left:0;right:auto" : "left:auto;right:0"};width:${dw}px;height:auto;padding:4px 10px 10px;overflow:auto`);
      return left ? { l: dw + 34, r: 16, t: top + 12, b: 30 } : { l: 40, r: dw + 12, t: top + 12, b: 30 }; }
    const dh = Math.round((c.h - top) * (o.hfrac || .48));
    set(`display:block;top:${top}px;left:0;right:0;height:${dh}px;width:auto;padding:4px 10px 6px;overflow:auto`);
    return { l: 38, r: 14, t: top + dh + 10, b: 26 };
  };

  // Eased window: k.smooth(view, {ymin, ymax}, dt) moves numeric fields toward the target (instant with reduced motion).
  kit.smooth = (cur, target, dt, rate = 6) => { for (const key in target) cur[key] = reduce || cur[key] === undefined ? target[key] : cur[key] + (target[key] - cur[key]) * Math.min(1, dt * rate); return cur; };

  // Standard readout. {title (set in capitals: no formulas), big, rows: [{lhs, v, cls, lbl}], landmark: {hit, big, note}, narr}
  kit.readout = o => {
    const rows = (o.rows || []).filter(Boolean).map(r => `<div class="row">${r.lhs ? `<span class="m">${r.lhs}</span>` : ""}${r.v !== undefined ? ` <span class="v ${r.cls || ""}">${r.v}</span>` : ""}${r.lbl ? `<span class="lbl">${r.lbl}</span>` : ""}</div>`).join("");
    const lm = o.landmark ? `<div class="landmark${o.landmark.hit ? " hit" : ""}"><div class="big">${o.landmark.big || ""}</div>${o.landmark.note ? `<div class="note">${o.landmark.note}</div>` : ""}</div>` : "";
    kit.setRO(`<div>${o.title ? `<h2>${o.title}</h2>` : ""}${o.big ? `<div class="ro-big" style="margin-top:8px">${o.big}</div>` : ""}</div>${rows ? `<div class="ro-rows">${rows}</div>` : ""}${lm}${o.narr ? `<p class="narr">${o.narr}</p>` : ""}`);
  };

  /* ---- Numbers you can change (the interaction rule: every number a computation uses can be changed by the learner) ----
     S = k.vars([{key, value, min, max, step, cls: "c2", fmt: v => text, typeStep, label, px}], onChange(key, v, S))
       S.a (current value), S.set("a", v) (no onChange), S.html("a", {cls, fmt}) → a scrubbable <span> to put in ANY
       markup the lab renders (readout big/rows, steps panel, k.eqline, DOM panels; re-rendering is fine).
     The learner drags the number left/right (one step per `px` px, default 6; Shift = ×10), clicks it to type a value
     (3/4, −2.5, 2π/3, √2 …; snapped to typeStep, default step, and clamped), or focuses it with Tab and uses ↑/↓
     (Shift ×10), Home/End, Enter to type. Values stay inside [min, max]. A value pinned at a bound gets .min/.max.
     k.eqline(html) shows a full-width equation strip in the controls (call each frame; only redraws on change);
     returns its element. Use it for "the equation you can edit" when the readout is busy. */
  kit.vars = (defs, onChange) => {
    const S = {}, D = {};
    defs.forEach(d => { D[d.key] = Object.assign({ step: 1, min: -Infinity, max: Infinity, px: 6 }, d); S[d.key] = d.value; });
    const textOf = (key, f) => { const d = D[key], v = S[key]; return (f || d.fmt || (x => numText(x, Math.min(6, decimals(d.typeStep || d.step) + 2))))(v); };
    const hide = (k, v) => Object.defineProperty(S, k, { value: v, enumerable: false });
    hide("defs", D);
    hide("set", (key, v) => { S[key] = clamp(v, D[key].min, D[key].max); });
    hide("change", (key, v) => { const d = D[key], nv = clamp(v, d.min, d.max); if (nv === S[key]) return false; S[key] = nv; if (onChange) onChange(key, nv, S); return true; });
    hide("html", (key, o = {}) => { const d = D[key]; if (!d) return "?"; const v = S[key], cls = o.cls ?? d.cls ?? "c1";
      return `<span class="kv ${cls}${S.__on === key ? " on" : ""}${v <= d.min ? " min" : ""}${v >= d.max ? " max" : ""}" data-kv="${key}" data-kvs="${S.__id}" tabindex="0" role="spinbutton" aria-label="${esc(d.label || key)}" aria-valuenow="${v}"${isFinite(d.min) ? ` aria-valuemin="${d.min}"` : ""}${isFinite(d.max) ? ` aria-valuemax="${d.max}"` : ""} title="Drag, or click to type">${textOf(key, o.fmt)}</span>`; });
    // A signed term for equations: S.term("b", {v: "<i>x</i>", first}) → " + 3x" / " − 3x" (|value| is the scrubbable number,
    // the sign sits outside it), first term: "3x" / "−3x". o.v: the variable HTML after the number ("" for a constant).
    // A zero coefficient still shows (dimmed) so it can be scrubbed back.
    hide("term", (key, o = {}) => { const d = D[key]; if (!d) return "?"; const v = S[key], sign = v < 0 ? MI : "+", f = d.fmt || (x => numText(x, Math.min(6, decimals(d.typeStep || d.step) + 2)));
      const num = S.html(key, Object.assign({}, o, { fmt: x => f(Math.abs(x)) })), body = `${num}${o.v || ""}`;
      const out = o.first ? (v < 0 ? MI : "") + body : ` ${sign} ${body}`; return v === 0 ? `<span class="dim">${out}</span>` : out; });
    hide("__id", "s" + (++uid));
    Object.defineProperty(S, "__on", { value: null, writable: true, enumerable: false });
    stores.set(S.__id, S);
    return S;
  };
  const stores = new Map();
  const roots = [stage, ro, ctl];
  const find = el => { const t = el && el.closest && el.closest("[data-kv]"); if (!t) return null; const S = stores.get(t.dataset.kvs); return S ? { t, S, key: t.dataset.kv } : null; };
  const refocus = (sid, key) => { const again = () => { const a = document.activeElement; if (a && a.dataset && a.dataset.kv === key && a.isConnected) return; for (const r of roots) { const e = r.querySelector(`[data-kvs="${sid}"][data-kv="${key}"]`); if (e) { e.focus({ preventScroll: true }); return; } } }; requestAnimationFrame(() => { again(); requestAnimationFrame(again); }); };
  let scrub = null;
  const editor = (hit) => {
    const { t, S, key } = hit, d = S.defs[key], r = t.getBoundingClientRect(), inp = document.createElement("input");
    inp.className = "kv-edit"; inp.type = "text"; inp.inputMode = "decimal"; inp.value = numText(S[key], 6); inp.setAttribute("aria-label", `Type a value for ${d.label || key}`);
    const fs = getComputedStyle(t).fontSize; inp.style.cssText = `left:${Math.max(4, r.left - 8)}px;top:${r.top - 3}px;width:${Math.max(64, r.width + 34)}px;height:${r.height + 6}px;font-size:${fs}`;
    document.body.appendChild(inp); inp.focus(); inp.select();
    let done = false;
    const close = commit => { if (done) return; if (commit) { let v = parseNum(inp.value); if (v == null) { inp.classList.remove("bad"); void inp.offsetWidth; inp.classList.add("bad"); inp.focus(); return; } v = snap(v, d.typeStep || d.step); S.change(key, v); } done = true; inp.remove(); refocus(S.__id, key); };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); close(true); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(false); } });
    inp.addEventListener("blur", () => close(true));
    live.offs.add(() => { done = true; inp.remove(); });
  };
  roots.forEach(root => {
    listen(root, "pointerdown", e => { if (e.button !== 0) return; const hit = find(e.target); if (!hit) return; e.preventDefault(); scrub = { hit, x0: e.clientX, v0: hit.S[hit.key], moved: false, id: e.pointerId, root }; try { root.setPointerCapture(e.pointerId); } catch (_) {} });
    listen(root, "pointermove", e => { if (!scrub || scrub.root !== root) return; const dx = e.clientX - scrub.x0; if (!scrub.moved && Math.abs(dx) < 4) return;
      if (!scrub.moved) { scrub.moved = true; document.body.classList.add("kv-scrubbing"); scrub.hit.S.__on = scrub.hit.key; }
      const d = scrub.hit.S.defs[scrub.hit.key]; scrub.hit.S.change(scrub.hit.key, scrubValue(scrub.v0, dx, { step: d.step * (e.shiftKey ? 10 : 1), px: d.px, min: d.min, max: d.max, origin: 0 })); });
    const end = e => { if (!scrub || scrub.root !== root) return; const s = scrub; scrub = null; document.body.classList.remove("kv-scrubbing"); s.hit.S.__on = null; try { root.releasePointerCapture(s.id); } catch (_) {}
      roots.forEach(r => r.querySelectorAll(".kv.on").forEach(x => x.classList.remove("on")));
      if (e.type === "pointerup" && !s.moved) editor(s.hit); };
    listen(root, "pointerup", end); listen(root, "pointercancel", end);
    listen(root, "keydown", e => { const hit = find(e.target); if (!hit || e.target.classList.contains("kv-edit")) return; const { S, key } = hit, d = S.defs[key], st = d.step * (e.shiftKey ? 10 : 1);
      let v = null; if (e.key === "ArrowUp" || e.key === "ArrowRight") v = snap(S[key] + st, d.step); else if (e.key === "ArrowDown" || e.key === "ArrowLeft") v = snap(S[key] - st, d.step);
      else if (e.key === "Home" && isFinite(d.min)) v = d.min; else if (e.key === "End" && isFinite(d.max)) v = d.max;
      else if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); editor(hit); return; }
      if (v === null) return; e.preventDefault(); S.change(key, v); refocus(S.__id, key); });
  });
  let eqEl = null, eqLast = null;
  kit.eqline = (html, tag) => { if (!eqEl) { eqEl = document.createElement("div"); eqEl.className = "ctl eqline"; ctl.insertBefore(eqEl, ctl.firstChild); }
    const h = (tag ? `<span class="eqtag">${tag}</span>` : "") + `<span class="m">${html}</span>`; if (h !== eqLast) { eqEl.innerHTML = h; eqLast = h; } return eqEl; };

  // Sliders from a config. defs: [{key, label, min, max, step, value, cls: "c2", fmt}] → state S (S.a, S.set("a", v)).
  // For "numbers you can change" in the equation itself, use k.vars (scrubbable) instead or as well.
  kit.params = (defs, onChange) => {
    const S = {}, ctlr = {}, f2 = v => numText(v, 2);
    defs.forEach(dd => { S[dd.key] = dd.value; ctlr[dd.key] = kit.slider(dd.label || `<span class="${dd.cls || "c1"}"><i>${dd.key}</i></span>`, dd.min, dd.max, dd.step, dd.value, v => { S[dd.key] = v; if (onChange) onChange(dd.key, v, S); }, dd.fmt || f2); });
    Object.defineProperty(S, "set", { value: (key, v) => { S[key] = v; ctlr[key].set(v); }, enumerable: false });
    Object.defineProperty(S, "ctl", { value: ctlr, enumerable: false });
    return S;
  };
  kit.fontsReady = cb => { if (document.fonts && document.fonts.ready) document.fonts.ready.then(cb); };
  exts.forEach(fn => fn(kit));
  return kit;
}
function stopAll(){ live.expose = null; live.values = {}; live.auto = {}; live.loops.forEach(L => L.on = false); live.loops.clear(); live.ros.forEach(o => o.disconnect()); live.ros.clear(); live.timers.forEach(id => clearInterval(id)); live.timers.clear(); live.offs.forEach(f => { try { f(); } catch (_) {} }); live.offs.clear(); document.body.classList.remove("kv-scrubbing"); }
function drive(cmd){
  const ex = live.expose || {}; let did = false;
  String(cmd).split(",").forEach(part => { const [name, ...rest] = part.trim().split(":"); const fn = typeof ex[name] === "function" ? ex[name] : live.auto[name]; if (typeof fn === "function") { fn(rest.join(":")); did = true; } });
  return did;
}
W.LabKit = { make, stopAll, rules, extend: fn => exts.push(fn), css: addCSS, C, F, alpha, drive, value: key => live.values[key], commands: () => [...new Set([...Object.keys(live.expose || {}), ...Object.keys(live.auto)])], values: () => Object.keys(live.values) };   // commands/values: what the open lab exposes and publishes (interact.js checks every chip and goal against them)
W.LABS = W.LABS || {};
})();
