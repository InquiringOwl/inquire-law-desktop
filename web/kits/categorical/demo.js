/* Storyboard player (categorical kit, loaded with the other kits before app.js). window.InquireDemo
   A small looping picture that shows what a lab does before the reader touches it. Concept cards use it
   (docs/subjects/LAYERS.md → "Concept blocks"). The spec is plain data so content files can hold it:
     { kind: "dots", slots: 6, lit: 5, sweep: true, big: true, ms: 420, alt: "…" }
       slots   number of dot positions in the row
       lit     dots filled (amber, c1)
       sweep   each lit dot is lit in turn and stamped 1, 2, 3 … (like the lab's Count aloud)
       big     last frame lifts the final number out as a big amber numeral
       still   (any kind) no autoplay or ↻: the page shows frame i with api.goto(i); mount() leaves the api on host._demo
       grow    [5, 6, 7]  the count grows; a dashed cyan "n+1" dot always waits after the last lit dot (c2)
       frames  explicit [{lit, say, big, next}] when the shortcuts above are not enough
     { kind: "range", from: 14, to: 22, step: 1, gaps: true, unit: "seat", alt }   a numbered row (seats, days, pages…):
       each item gets its counting number 1, 2, 3 … in turn, the total lifts out; gaps: true then marks the gaps between
       neighbours (one fewer than the items: the b − a slip). Rows over 11 items show the first 6, "…", the last 3.
     { kind: "tens", n: 47, unit: "stitches", alt }   groups of ten (ten-frames) counted 10, 20, 30 …, then the ones.
   Task visuals (Intermediate "Everyday tasks") use these so each problem gets a picture of its own situation in a few bytes.
   InquireDemo.rangeCells(spec) → [{v, n} | {dots: true}] and InquireDemo.seqFrames(spec) (DOM-free, tested)
   InquireDemo.frames(spec) → frames, InquireDemo.slotStates(frame, slots) → [{s: "off|on|say|next", n}]  (DOM-free, tested)
   InquireDemo.mount(host, spec) → {replay, stop}; InquireDemo.mountAll(root) mounts every [data-spec] inside root.
   It plays once when it scrolls into view and again on tap or on the ↻ button. With reduced motion (OS or the app's
   setting) it shows the final frame and nothing moves. Colours come from CSS variables, so themes never break it. */
(function(){
const W = typeof window !== "undefined" ? window : globalThis;

function frames(spec){
  if (spec.frames) return spec.frames.map(f => ({ lit: f.lit | 0, say: f.say | 0, big: f.big == null ? null : f.big, next: !!f.next }));
  const out = [];
  if (spec.grow) { spec.grow.forEach(n => out.push({ lit: n | 0, say: 0, big: null, next: true })); return out; }
  const lit = spec.lit | 0;
  if (spec.sweep) { out.push({ lit, say: 0, big: null, next: false }); for (let i = 1; i <= lit; i++) out.push({ lit, say: i, big: null, next: false }); }
  else out.push({ lit, say: 0, big: null, next: !!spec.next });
  if (spec.big) out.push({ lit, say: lit, big: lit, next: false });
  return out;
}
function slotStates(f, slots){
  const out = [];
  for (let i = 1; i <= slots; i++) {
    if (i <= f.lit) out.push({ s: f.say === i ? "say" : "on", n: f.say >= i ? String(i) : "" });
    else if (i === f.lit + 1 && f.next) out.push({ s: "next", n: "n+1" });
    else out.push({ s: "off", n: "" });
  }
  return out;
}
const plural = (u, n) => !u ? "" : n === 1 ? u : /(s|x|ch|sh)$/.test(u) ? u + "es" : /[^aeiou]y$/.test(u) ? u.slice(0, -1) + "ies" : u + "s";
function rangeCells(spec){
  const step = spec.step || 1, vals = [];
  for (let v = spec.from; step > 0 ? v <= spec.to : v >= spec.to; v += step) vals.push(v);
  const cells = vals.map((v, i) => ({ v, n: i + 1 }));
  return cells.length > 11 ? [...cells.slice(0, 6), { dots: true }, ...cells.slice(-3)] : cells;
}
// One frame = {say: how many shown items carry their number, big: total or null, gaps: bool} (range) or {tens, ones, big} (tens)
function seqFrames(spec){
  const out = [];
  if (spec.kind === "range") {
    const cells = rangeCells(spec), shown = cells.filter(c => !c.dots).length, total = Math.round((spec.to - spec.from) / (spec.step || 1)) + 1;
    for (let i = 0; i <= shown; i++) out.push({ say: i, big: null, gaps: false });
    out.push({ say: shown, big: total, gaps: false });
    if (spec.gaps) out.push({ say: shown, big: total, gaps: true });
  } else if (spec.kind === "tens") {
    const T = Math.floor(spec.n / 10), O = spec.n % 10;
    for (let i = 0; i <= T; i++) out.push({ tens: i, ones: 0, big: null });
    for (let j = 1; j <= O; j++) out.push({ tens: T, ones: j, big: null });
    out.push({ tens: T, ones: O, big: spec.n });
  } else if (spec.kind === "line") {
    const P = (spec.points || []).length, J = (spec.jumps || []).length;
    for (let i = 0; i <= P; i++) out.push({ pts: i, jumps: 0, big: null, dist: false });
    for (let j = 1; j <= J; j++) out.push({ pts: P, jumps: j, big: null, dist: false });
    if (J) out.push({ pts: P, jumps: J, big: lineEnd(spec), dist: false });
    else if (spec.show === "dist" && P >= 2) out.push({ pts: P, jumps: 0, big: Math.abs(spec.points[0].v - spec.points[1].v), dist: true });
  } else if (spec.kind === "columns") {
    const pl = colPlan(spec), S = pl.op ? pl.steps.length : pl.n;
    for (let i = 0; i <= S; i++) out.push({ k: i, big: null });
    out.push({ k: S, big: pl.result });
  } else if (spec.kind === "bar") {
    const b = barParts(spec), P = b.parts.length;
    for (let i = 0; i <= P; i++) out.push({ parts: i, brace: false, reveal: false, big: null });
    out.push({ parts: P, brace: true, reveal: false, big: b.unknown >= 0 ? null : b.total });
    if (b.unknown >= 0) out.push({ parts: P, brace: true, reveal: true, big: b.parts[b.unknown] });
  } else if (spec.kind === "fraction") {
    const lab = fracLabel(spec.n, spec.d, spec.mixed);
    for (let i = 0; i <= spec.n; i++) out.push({ lit: i, split: false, big: null });
    out.push({ lit: spec.n, split: false, big: lab });
    if (spec.split) out.push({ lit: spec.n, split: true, big: `${spec.n * spec.split}/${spec.d * spec.split}` });
  } else if (spec.kind === "array") {
    for (let r = 0; r <= spec.rows; r++) out.push({ rows: r, big: null });
    out.push({ rows: spec.rows, big: spec.rows * spec.cols });
  }
  return out;
}
/* ---------- more kinds (1.18.5, for the Arithmetic rollout): line, columns, bar, array ----------
   { kind: "line", from: 0, to: 20, points: [{v: 7, c: "c2", label: "a"}, {v: 12, c: "c3", label: "b"}], show: "dist", alt }
     a number line; the points appear in turn; show: "dist" ends on a bracket between the first two points and lifts out the distance.
   { kind: "line", from: 0, to: 20, start: 8, jumps: [5, -3], unit: "step", alt }
     a dot starts at `start` and hops each jump in turn (arcs labelled +5, −3); the end value lifts out.
   { kind: "columns", n: 2354, alt }            place-value columns, filled from the left: digit, then its value (2 × 1,000 = 2,000).
   { kind: "columns", add: [368, 457], alt }    column addition right to left, carries written above the next column.
   { kind: "columns", sub: [503, 168], alt }    column subtraction right to left, regrouping shown above the top digits.
   { kind: "bar", parts: [340, 125], labels: ["rent", "food"], unit: "dollar", alt }   a bar model; parts appear, then the brace and the total.
     One part may be null with `total` given: it shows "?" until the last frame, which reveals it (missing part / subtraction).
   { kind: "array", rows: 3, cols: 4, unit: "chair", alt }   equal rows lit one row at a time (4, 8, 12), then the product.
   Any kind takes `cap` (the small caption under the big number). All are still-able (`still: true` + host._demo.goto(i) in
   Concept walks) and DOM-free in seqFrames for tests. InquireDemo.check(spec) lists problems with a spec (validate.js uses it). */
function lineEnd(spec){ return (spec.start || 0) + (spec.jumps || []).reduce((s, j) => s + j, 0); }
function niceTick(span){ for (const s of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]) if (span / s <= 10) return s; return Math.ceil(span / 10); }
function digitsR(N, n){ return String(N).padStart(n, "0").split("").reverse().map(Number); }
function colPlan(spec){
  if (spec.add) { const [A, B] = spec.add, n = Math.max(String(A).length, String(B).length), a = digitsR(A, n + 1), b = digitsR(B, n + 1), steps = []; let carry = 0;
    for (let i = 0; i < n; i++) { const s = a[i] + b[i] + carry, cin = carry; carry = s >= 10 ? 1 : 0; steps.push({ i, s, digit: s % 10, cin, cout: carry }); }
    if (carry) steps.push({ i: n, s: carry, digit: carry, cin: carry, cout: 0, final: true });
    return { op: "+", A, B, a, b, n: n + (carry ? 1 : 0), steps, result: A + B }; }
  if (spec.sub) { const [A, B] = spec.sub, n = String(A).length, a = digitsR(A, n), b = digitsR(B, n), top = a.slice(), marks = a.map(() => []), steps = [];
    for (let i = 0; i < n; i++) { let borrow = null;
      if (top[i] < b[i]) { let j = i + 1; while (top[j] === 0) j++; borrow = j; top[j] -= 1; marks[j].push({ v: top[j], at: i }); for (let q = j - 1; q > i; q--) { top[q] = 9; marks[q].push({ v: 9, at: i }); } top[i] += 10; marks[i].push({ v: top[i], at: i }); }
      steps.push({ i, t: top[i], b: b[i], digit: top[i] - b[i], borrow }); }
    return { op: "−", A, B, a, b, n, steps, marks, result: A - B }; }
  const ds = String(spec.n).split("").map(Number); return { op: "", n: ds.length, ds, result: spec.n };
}
function barParts(spec){
  const P = spec.parts.slice(), u = P.indexOf(null), known = P.filter(x => x != null).reduce((s, x) => s + x, 0);
  const total = u >= 0 ? spec.total : known;
  if (u >= 0) P[u] = spec.total - known;
  return { parts: P, unknown: u, total };
}
// The frame a held picture waits on: the situation with no answer in it (see player, spec.hold).
// "3/4", or "2 3/4" with mixed (an improper fraction as a whole number and a fraction)
function fracLabel(n, d, mixed){ if (!mixed || n < d) return `${n}/${d}`; const w = Math.floor(n / d), r = n % d; return r ? `${w} ${r}/${d}` : String(w); }
function holdFrame(spec){
  if (spec.kind === "line") return (spec.jumps || []).length ? 0 : (spec.points || []).length;
  if (spec.kind === "bar") { const b = barParts(spec); return b.parts.length + (b.unknown >= 0 ? 1 : 0); }
  return 0;
}
const KINDS = ["dots", "range", "tens", "line", "columns", "bar", "array", "fraction"];
function check(spec){
  const out = [], int = v => Number.isInteger(v), num = v => typeof v === "number" && isFinite(v);
  if (!spec || !KINDS.includes(spec.kind)) return [`kind must be one of ${KINDS.join(", ")}`];
  if (typeof spec.alt !== "string" || spec.alt.length < 12) out.push("alt must describe the picture (a sentence)");
  const k = spec.kind;
  if (k === "dots") { if (!int(spec.slots) || spec.slots < 2 || spec.slots > 14) out.push("slots must be an integer 2 to 14");
    if (spec.grow !== undefined && (!Array.isArray(spec.grow) || spec.grow.length < 2 || spec.grow.some(n => !int(n) || n < 0 || n >= spec.slots))) out.push("grow must list 2 or more counts below slots"); }
  if (k === "range" && (!int(spec.from) || !int(spec.to) || (spec.to - spec.from) / (spec.step || 1) < 1)) out.push("range needs integers from < to");
  if (k === "tens" && (!int(spec.n) || spec.n < 1 || spec.n > 99)) out.push("tens needs an integer n from 1 to 99");
  if (k === "line") { if (!num(spec.from) || !num(spec.to) || spec.to <= spec.from) out.push("line needs from < to");
    const pts = spec.points || [], J = spec.jumps || [];
    if (!pts.length && spec.start === undefined) out.push("line needs points or a start");
    pts.forEach((p, i) => { if (!num(p.v) || p.v < spec.from || p.v > spec.to) out.push(`points[${i}].v must be inside from..to`); });
    if (J.length && !num(spec.start)) out.push("jumps need a start");
    let at = spec.start; J.forEach((j, i) => { if (!num(j) || !j) out.push(`jumps[${i}] must be a non-zero number`); at += j; if (at < spec.from || at > spec.to) out.push(`jump ${i + 1} lands at ${at}, outside from..to`); });
    if (spec.show === "dist" && pts.length < 2) out.push('show: "dist" needs two points'); }
  if (k === "columns") { const ok = v => int(v) && v >= 0 && v <= 9999999;
    if (spec.add) { if (!Array.isArray(spec.add) || spec.add.length !== 2 || !spec.add.every(ok)) out.push("columns.add must be two whole numbers"); }
    else if (spec.sub) { if (!Array.isArray(spec.sub) || spec.sub.length !== 2 || !spec.sub.every(ok) || spec.sub[1] > spec.sub[0]) out.push("columns.sub must be two whole numbers, the first not smaller"); }
    else if (!ok(spec.n)) out.push("columns needs n, add or sub"); }
  if (k === "bar") { const P = spec.parts;
    if (!Array.isArray(P) || P.length < 1 || P.length > 6) out.push("bar.parts must list 1 to 6 parts");
    else { const nul = P.filter(x => x === null).length;
      if (nul > 1) out.push("bar: at most one unknown (null) part");
      if (P.some(x => x !== null && (!num(x) || x <= 0))) out.push("bar parts must be positive numbers");
      if (nul && (!num(spec.total) || spec.total <= P.filter(x => x != null).reduce((s, x) => s + x, 0))) out.push("bar with an unknown part needs a total larger than the known parts"); }
    if (spec.labels !== undefined && (!Array.isArray(spec.labels) || spec.labels.length !== (P || []).length)) out.push("bar.labels needs one label per part"); }
  if (k === "fraction") { if (!int(spec.d) || spec.d < 1 || spec.d > 12) out.push("fraction.d must be 1 to 12");
    else { if (!int(spec.n) || spec.n < 0 || Math.ceil(spec.n / spec.d) > 4) out.push("fraction.n must be 0 or more and fill at most 4 wholes");
      if (spec.split !== undefined && (!int(spec.split) || spec.split < 2 || spec.split * spec.d > 24)) out.push("fraction.split must be 2 or more, with split × d at most 24"); } }
  if (k === "array" && (!int(spec.rows) || !int(spec.cols) || spec.rows < 1 || spec.cols < 1 || spec.rows > 10 || spec.cols > 12)) out.push("array needs rows 1–10 and cols 1–12");
  return out;
}
W.InquireDemo = { fracLabel, frames, slotStates, rangeCells, seqFrames, plural, colPlan, barParts, lineEnd, check, KINDS, holdFrame };
if (typeof document === "undefined") return;

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const calm = () => document.documentElement.hasAttribute("data-reduce-motion") || (W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches);

// Plays frames on a host: once when scrolled into view, again on tap or ↻; final frame only under reduced motion.
// spec.still: no autoplay, the page steps it with goto(i). spec.hold (an Everyday task that is a problem): it waits on
// holdFrame(spec), the situation without the answer, until the page calls release() once the task is solved or shown.
function player(host, svg, n, show, spec){
  let timer = null, played = false, ui = false;
  const stop = () => { clearTimeout(timer); timer = null; };
  const ms = spec.ms || 420;
  const play = () => {
    stop(); played = true;
    if (calm() || n < 2) { show(n - 1); return; }
    let i = 0; show(0);
    const step = () => { i++; if (i >= n || !host.isConnected) return; show(i); timer = setTimeout(step, i >= n - 2 ? ms * 2.2 : ms); };
    timer = setTimeout(step, ms);
  };
  const goto = i => { stop(); played = true; show(Math.max(0, Math.min(n - 1, i))); };
  const addUI = () => { if (ui || calm()) return; ui = true;
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "dm-replay"; btn.setAttribute("aria-label", "Replay the animation"); btn.textContent = "↻";
    btn.addEventListener("click", play); host.appendChild(btn); svg.addEventListener("click", play); };
  if (spec.still) { show(0); return { replay: () => {}, stop, goto }; }   // still: the page steps it with goto(i) (Concept walk)
  if (spec.hold) { show(Math.min(n - 1, holdFrame(spec))); let out = false;
    return { replay: play, stop, goto, release: () => { if (out) return; out = true; addUI(); play(); } }; }
  show(calm() ? n - 1 : 0);
  if (!calm()) {
    addUI();
    if (W.IntersectionObserver) {
      const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !played) { play(); io.disconnect(); } }, { threshold: 0.5 });
      io.observe(host);
    } else play();
  }
  return { replay: play, stop, goto };
}
function mountRange(host, spec){
  const cells = rangeCells(spec), fr = seqFrames(spec), CW = 36, GAP = 8, H = 70, X0 = 4;
  const total = Math.round((spec.to - spec.from) / (spec.step || 1)) + 1, width = X0 + cells.length * (CW + GAP) + 132;
  host.textContent = "";
  const svg = el("svg", { viewBox: `0 0 ${width} ${H}`, role: "img", "aria-label": spec.alt || "Animation", preserveAspectRatio: "xMinYMid meet" }, host);
  const parts = cells.map((c, i) => {
    const x = X0 + i * (CW + GAP);
    if (c.dots) { el("text", { class: "dq-dots", x: x + CW / 2, y: 26 }, svg).textContent = "…"; return null; }
    const r = el("rect", { class: "dq-cell", x, y: 10, width: CW, height: 26, rx: 4, "data-s": "off" }, svg);
    el("text", { class: "dq-v", x: x + CW / 2, y: 24 }, svg).textContent = String(c.v);
    const n = el("text", { class: "dq-n", x: x + CW / 2, y: 54 }, svg);
    return { r, n, c, x };
  });
  const gaps = [];
  cells.forEach((c, i) => { const nx = cells[i + 1]; if (c.dots || !nx || nx.dots) return;
    const x = X0 + i * (CW + GAP) + CW + GAP / 2; gaps.push(el("path", { class: "dq-gap", d: `M${x - 3} 6 L${x} 2 L${x + 3} 6 M${x} 2 V40`, opacity: 0 }, svg)); });
  const bx = X0 + cells.length * (CW + GAP) + 6;
  const big = el("text", { class: "dm-big dq-big", x: bx, y: 34, opacity: 0 }, svg), cap = el("text", { class: "dq-cap", x: bx + 2, y: 54, opacity: 0 }, svg);
  const shown = parts.filter(Boolean);
  const show = i => { const f = fr[i];
    shown.forEach((p, j) => { const on = j < f.say; p.r.setAttribute("data-s", f.gaps ? "dim" : on ? (j === f.say - 1 && f.big == null ? "say" : "on") : "off"); p.n.textContent = on && !f.gaps ? String(p.c.n) : ""; });
    gaps.forEach(g => g.setAttribute("opacity", f.gaps ? 1 : 0));
    big.textContent = f.big == null ? "" : String(f.gaps ? total - 1 : f.big); big.setAttribute("opacity", f.big == null ? 0 : 1); big.setAttribute("data-k", f.gaps ? "gap" : "n");
    cap.textContent = f.big == null ? "" : f.gaps ? `gaps, not ${plural(spec.unit || "item", 2)}` : plural(spec.unit || "item", total); cap.setAttribute("opacity", f.big == null ? 0 : 1); };
  return player(host, svg, fr.length, show, spec);
}
function mountTens(host, spec){
  const fr = seqFrames(spec), T = Math.floor(spec.n / 10), O = spec.n % 10, D = 9, GW = 5 * D + 10, H = 70, X0 = 4;
  const width = X0 + T * (GW + 8) + Math.max(O, 1) * 0 + (O ? Math.ceil(O / 2) * D + 14 : 0) + 120;
  host.textContent = "";
  const svg = el("svg", { viewBox: `0 0 ${width} ${H}`, role: "img", "aria-label": spec.alt || "Animation", preserveAspectRatio: "xMinYMid meet" }, host);
  const groups = [];
  for (let g = 0; g < T; g++) { const gx = X0 + g * (GW + 8), dots = [];
    el("rect", { class: "dq-frame", x: gx, y: 8, width: GW, height: 2 * D + 10, rx: 3 }, svg);
    for (let k = 0; k < 10; k++) dots.push(el("circle", { class: "dm-c dq-d", cx: gx + 5 + D / 2 + (k % 5) * D, cy: 13 + D / 2 + Math.floor(k / 5) * D, r: 3.4, "data-s": "off" }, svg));
    const lab = el("text", { class: "dq-n", x: gx + GW / 2, y: 54 }, svg); groups.push({ dots, lab, v: (g + 1) * 10 }); }
  const ox = X0 + T * (GW + 8) + 4, ones = [];
  for (let j = 0; j < O; j++) ones.push(el("circle", { class: "dm-c dq-d", cx: ox + D / 2 + Math.floor(j / 2) * D, cy: 13 + D / 2 + (j % 2) * D, r: 3.4, "data-s": "off" }, svg));
  const olab = el("text", { class: "dq-n", x: ox + Math.ceil(O / 2) * D / 2, y: 54 }, svg);
  const bx = ox + (O ? Math.ceil(O / 2) * D + 14 : 4);
  const big = el("text", { class: "dm-big dq-big", x: bx, y: 34, opacity: 0 }, svg), cap = el("text", { class: "dq-cap", x: bx + 2, y: 54, opacity: 0 }, svg);
  const show = i => { const f = fr[i];
    groups.forEach((g, k) => { const on = k < f.tens; g.dots.forEach(d => d.setAttribute("data-s", on ? (k === f.tens - 1 && !f.ones && f.big == null ? "say" : "on") : "off")); g.lab.textContent = on ? String(g.v) : ""; });
    ones.forEach((d, j) => d.setAttribute("data-s", j < f.ones ? (j === f.ones - 1 && f.big == null ? "say" : "on") : "off"));
    olab.textContent = f.ones ? `+${f.ones}` : "";
    big.textContent = f.big == null ? "" : String(f.big); big.setAttribute("opacity", f.big == null ? 0 : 1);
    cap.textContent = f.big == null ? "" : `${T} ten${T === 1 ? "" : "s"} + ${O} ${plural(spec.unit || "one", 2)}`.replace(/ \+ 0 \w+$/, ""); cap.setAttribute("opacity", f.big == null ? 0 : 1); };
  return player(host, svg, fr.length, show, spec);
}
// ---- line, columns, bar, array (1.18.5) ----
const COLV = { c1: "amber", c2: "cyan", c3: "pink", c4: "violet", c5: "green" };
const fmtN = v => (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("en-US");
// A host narrower than 380 px (an idea card) gets a tighter picture, so its text stays readable.
const narrow = host => host.clientWidth > 0 && host.clientWidth < 380;
const svgFor = (host, spec, W, H) => { host.textContent = ""; const s = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": spec.alt || "Animation", preserveAspectRatio: "xMinYMid meet" }, host); s.style.maxHeight = Math.round(H * 1.25) + "px"; return s; };
const bigCap = (svg, x, y) => [el("text", { class: "dm-big dq-big", x, y, opacity: 0 }, svg), el("text", { class: "dq-cap", x: x + 2, y: y + 20, opacity: 0 }, svg)];
const setBig = (big, cap, v, text) => { big.textContent = v == null ? "" : typeof v === "string" ? v.replace("-", "−") : fmtN(v); big.setAttribute("opacity", v == null ? 0 : 1); cap.textContent = v == null ? "" : text; cap.setAttribute("opacity", v == null ? 0 : 1); };
function mountLine(host, spec){
  const nw = narrow(host), fr = seqFrames(spec), W = nw ? 300 : 540, H = 92, L = nw ? 12 : 18, Rr = W - (nw ? 104 : 128), Y = 58, span = spec.to - spec.from, X = v => L + (Rr - L) * (v - spec.from) / span;
  const svg = svgFor(host, spec, W, H); if (nw) svg.setAttribute("data-nw", "");
  el("line", { class: "dq-axis", x1: L - 10, y1: Y, x2: Rr + 10, y2: Y }, svg); el("path", { class: "dq-axis", d: `M${Rr + 4} ${Y - 4} L${Rr + 10} ${Y} L${Rr + 4} ${Y + 4}` }, svg);
  const lab = spec.tick || niceTick(nw ? span * 2 : span), minor = span <= 40 && Number.isInteger(spec.from) ? 1 : lab;
  for (let v = Math.ceil(spec.from / minor) * minor; v <= spec.to + 1e-9; v += minor) { const major = Math.abs(v / lab - Math.round(v / lab)) < 1e-9;
    el("line", { class: "dq-tick", x1: X(v), y1: Y - (major ? 6 : 3), x2: X(v), y2: Y + (major ? 6 : 3) }, svg);
    if (major) el("text", { class: "dq-tl", x: X(v), y: Y + 20 }, svg).textContent = fmtN(+v.toFixed(6)); }
  const P = spec.points || [], J = spec.jumps || [];
  const brk = P.length >= 2 ? el("path", { class: "dq-brk", d: `M${X(P[0].v)} ${Y - 26} v-6 H${X(P[1].v)} v6`, opacity: 0 }, svg) : null;
  const pts = P.map(p => { const g = el("g", { class: "dq-g", opacity: 0, style: `--c:var(--${COLV[p.c || "c1"]})` }, svg);
    el("circle", { class: "dq-pt", cx: X(p.v), cy: Y, r: 5.5 }, g); el("text", { class: "dq-pl", x: X(p.v), y: p.below ? Y + 33 : Y - 12 }, g).textContent = p.label != null ? p.label : fmtN(p.v); return g; });
  let at = spec.start; const spans = [];   // an arc that overlaps an earlier one rises higher, so the labels never collide
  const arcs = J.map(j => { const x0 = X(at), x1 = X(at + j), lo = Math.min(x0, x1), hi = Math.max(x0, x1), over = spans.filter(([a, b]) => a < hi - 1 && b > lo + 1).length;
    spans.push([lo, hi]); const h = 12 + Math.min(14, (hi - lo) * .2) + over * 10, mx = (x0 + x1) / 2, g = el("g", { class: "dq-g", opacity: 0 }, svg);
    el("path", { class: "dq-arc", d: `M${x0} ${Y - 5} Q${mx} ${Y - 5 - 2 * h} ${x1} ${Y - 5}` }, g);
    const s = Math.sign(j); el("path", { class: "dq-arc", d: `M${x1 - 5 * s} ${Y - 11} L${x1} ${Y - 5} L${x1 - 7 * s} ${Y - 4}` }, g);
    el("text", { class: "dq-al", x: mx, y: Y - 9 - h }, g).textContent = (j > 0 ? "+" : "−") + Math.abs(j).toLocaleString("en-US"); at += j; return g; });
  const cur = spec.start != null ? el("circle", { class: "dq-pt dq-cur", cx: X(spec.start), cy: Y, r: 6 }, svg) : null;
  const [big, cap] = bigCap(svg, Rr + (nw ? 18 : 24), 46);
  const show = i => { const f = fr[i];
    pts.forEach((g, j) => g.setAttribute("opacity", j < f.pts ? 1 : 0)); arcs.forEach((g, j) => g.setAttribute("opacity", j < f.jumps ? 1 : 0));
    if (cur) cur.setAttribute("cx", X(spec.start + J.slice(0, f.jumps).reduce((s, j) => s + j, 0)));
    if (brk) brk.setAttribute("opacity", f.dist ? 1 : 0);
    setBig(big, cap, f.big, spec.cap || (f.dist ? (spec.unit ? plural(spec.unit, 2) + " apart" : "apart") : J.length ? "lands here" : "")); };
  return player(host, svg, fr.length, show, spec);
}
function mountColumns(host, spec){
  const pl = colPlan(spec), fr = seqFrames(spec), names = ["1s", "10s", "100s", "1,000s", "10,000s", "100,000s", "1,000,000s"];
  if (!pl.op) {   // place value: digits filled from the left, each with its value
    const nw = narrow(host), CW = nw ? 50 : 62, n = pl.n, W = 8 + n * CW + (nw ? 104 : 140), H = 84, svg = svgFor(host, spec, W, H), cols = [];
    pl.ds.forEach((d, j) => { const x = 8 + j * CW + CW / 2, p = n - 1 - j, val = d * 10 ** p;
      if (j) el("line", { class: "dq-sep", x1: 8 + j * CW, y1: 4, x2: 8 + j * CW, y2: 74 }, svg);
      el("text", { class: "dq-ch", x, y: 14 }, svg).textContent = names[p] || "10^" + p;
      const dg = el("text", { class: "dq-dg dq-g", x, y: 44, "data-k": "p" + (p % 4), opacity: 0 }, svg), cv = el("text", { class: "dq-cv dq-g", x, y: 66, opacity: 0 }, svg);
      dg.textContent = String(d); cv.textContent = fmtN(val); cols.push([dg, cv]); });
    const [big, cap] = bigCap(svg, 8 + n * CW + 14, 44);   // held (a task): the digits are the question, so they stay; the values are the answer
    return player(host, svg, fr.length, i => { const f = fr[i]; cols.forEach(([dg, cv], j) => { dg.setAttribute("opacity", j < f.k || spec.hold ? 1 : 0); cv.setAttribute("opacity", j < f.k ? 1 : 0); }); setBig(big, cap, f.big, spec.cap || "in all"); }, spec);
  }
  const CW = 26, n = pl.n, xR = 30 + n * CW, W = xR + 150, H = 100, svg = svgFor(host, spec, W, H), cx = i => xR - (i + .5) * CW;
  const hl = el("rect", { class: "dq-colhl", x: 0, y: 2, width: CW, height: 94, rx: 3, opacity: 0 }, svg);
  const lenA = String(pl.A).length, lenB = String(pl.B).length, lenR = String(pl.result).length;
  const res = [], up = [], cross = [];
  for (let i = 0; i < n; i++) {
    if (i < lenA) { el("text", { class: "dq-dg", x: cx(i), y: 44, "data-k": "a" }, svg).textContent = String(pl.a[i]); cross[i] = el("line", { class: "dq-x", x1: cx(i) - 7, y1: 37, x2: cx(i) + 7, y2: 29, opacity: 0 }, svg); }
    if (i < lenB) el("text", { class: "dq-dg", x: cx(i), y: 68, "data-k": "b" }, svg).textContent = String(pl.b[i]);
    up[i] = el("text", { class: "dq-cy", x: cx(i), y: 17 }, svg); res[i] = el("text", { class: "dq-dg", x: cx(i), y: 94, "data-k": "r" }, svg);
  }
  el("text", { class: "dq-dg", x: xR - (n + .55) * CW, y: 68 }, svg).textContent = pl.op;
  el("line", { class: "dq-rule", x1: xR - (n + 1) * CW, y1: 75, x2: xR + 4, y2: 75 }, svg);
  const [big, cap] = bigCap(svg, xR + 18, 52);
  const show = i => { const f = fr[i], K = f.k, S = pl.steps;
    const s = K < S.length ? S[K] : null; hl.setAttribute("opacity", s ? 1 : 0); if (s) hl.setAttribute("x", cx(s.i) - CW / 2);
    for (let c = 0; c < n; c++) { const st = S.find(x => x.i === c), done = st && S.indexOf(st) < K;
      res[c].textContent = done && c < lenR ? String(st.digit) : "";
      if (pl.op === "+") up[c].textContent = S.some((x, j) => j < K && x.i === c - 1 && x.cout && !x.final) ? "1" : "";
      else { const ms = (pl.marks[c] || []).filter(m => m.at < K); up[c].textContent = ms.length ? String(ms[ms.length - 1].v) : ""; if (cross[c]) cross[c].setAttribute("opacity", ms.length ? 1 : 0); } }
    setBig(big, cap, f.big, spec.cap || (pl.op === "+" ? "the sum" : "the difference")); };
  return player(host, svg, fr.length, show, spec);
}
function mountBar(host, spec){
  const nw = narrow(host), b = barParts(spec), fr = seqFrames(spec), BW = nw ? 200 : 340, sc = BW / b.total, ws = b.parts.map(p => Math.max(nw ? 34 : 40, p * sc)), tw = ws.reduce((s, w) => s + w, 0);
  const L = 4, W = L + tw + (nw ? 128 : 150), H = 96, svg = svgFor(host, spec, W, H), labs = spec.labels || []; if (nw) svg.setAttribute("data-nw", "");
  const brace = el("g", { class: "dq-g", opacity: 0 }, svg), mid = L + tw / 2;
  el("path", { class: "dq-brk", d: `M${L} 30 q0 -7 7 -7 H${mid - 7} q7 0 7 -7 q0 7 7 7 H${L + tw - 7} q7 0 7 7` }, brace);
  el("text", { class: "dq-al dq-tot", x: mid, y: 11 }, brace).textContent = fmtN(b.total);
  let x = L; const parts = b.parts.map((p, i) => { const g = el("g", { class: "dq-g", opacity: 0 }, svg), w = ws[i], u = i === b.unknown;
    el("rect", { class: "dq-bar", x, y: 34, width: w, height: 28, "data-k": u ? "u" : String(i % 2) }, g);
    const v = el("text", { class: "dq-bv", x: x + w / 2, y: 49 }, g); v.textContent = u ? "?" : fmtN(p);
    if (labs[i]) el("text", { class: "dq-bl", x: x + w / 2, y: 78 }, g).textContent = labs[i];
    x += w; return { g, v, u, p }; });
  const [big, cap] = bigCap(svg, L + tw + 16, 54);
  const show = i => { const f = fr[i];
    parts.forEach((q, j) => { q.g.setAttribute("opacity", j < f.parts ? 1 : 0); if (q.u) q.v.textContent = f.reveal ? fmtN(q.p) : "?"; });
    brace.setAttribute("opacity", f.brace ? 1 : 0);
    setBig(big, cap, f.big, spec.cap || (b.unknown >= 0 ? (labs[b.unknown] || "the missing part") : spec.unit ? plural(spec.unit, b.total) + " in all" : "in all")); };
  return player(host, svg, fr.length, show, spec);
}
function mountArray(host, spec){
  const fr = seqFrames(spec), R = spec.rows, Cn = spec.cols, D = 14, W = 8 + Cn * D + 46 + 140, H = Math.max(56, 8 + R * D + 6), svg = svgFor(host, spec, W, H);
  const rows = []; for (let r = 0; r < R; r++) { const dots = []; for (let c = 0; c < Cn; c++) dots.push(el("circle", { class: "dm-c dq-d", cx: 8 + D / 2 + c * D, cy: 8 + D / 2 + r * D, r: 4.6, "data-s": "off" }, svg));
    rows.push({ dots, t: el("text", { class: "dq-n", x: 8 + Cn * D + 20, y: 8 + D / 2 + r * D + 4 }, svg) }); }
  const [big, cap] = bigCap(svg, 8 + Cn * D + 52, Math.min(H - 24, 34));
  const show = i => { const f = fr[i]; rows.forEach((q, r) => { const on = r < f.rows; q.dots.forEach(d => d.setAttribute("data-s", on ? (r === f.rows - 1 && f.big == null ? "say" : "on") : "off")); q.t.textContent = on ? fmtN((r + 1) * Cn) : ""; });
    setBig(big, cap, f.big, spec.cap || `${R} × ${Cn}${spec.unit ? " " + plural(spec.unit, 2) : ""}`); };
  return player(host, svg, fr.length, show, spec);
}
function mountFraction(host, spec){   // fraction bars: a whole split into d equal parts, n shaded; split re-cuts every part into k
  const nw = narrow(host), fr = seqFrames(spec), d = spec.d, bars = Math.max(1, Math.ceil(spec.n / d)), BW = nw ? 200 : 300, BH = 26, G = 8, L = 4;
  const W = L + BW + (nw ? 128 : 150), H = Math.max(60, 10 + bars * (BH + G)), svg = svgFor(host, spec, W, H), cw = BW / d, cells = [], cuts = el("g", { class: "dq-g", opacity: 0 }, svg);
  for (let b = 0; b < bars; b++) { const y = 6 + b * (BH + G);
    for (let i = 0; i < d; i++) cells.push(el("rect", { class: "dq-cell", x: L + i * cw, y, width: cw, height: BH, "data-s": "off" }, svg));
    if (spec.split) for (let i = 0; i < d; i++) for (let j = 1; j < spec.split; j++) { const x = L + i * cw + j * cw / spec.split; el("line", { class: "dq-cut", x1: x, y1: y + 2, x2: x, y2: y + BH - 2 }, cuts); } }
  svg.appendChild(cuts);
  const [big, cap] = bigCap(svg, L + BW + 16, Math.min(H - 22, 36));
  const show = i => { const f = fr[i]; cells.forEach((c, j) => c.setAttribute("data-s", j < f.lit ? (j === f.lit - 1 && f.big == null ? "say" : "on") : "off")); cuts.setAttribute("opacity", f.split ? 1 : 0);
    setBig(big, cap, f.big, f.split ? "same amount" : spec.cap || (spec.n > d ? "wholes" : "of the whole")); };
  return player(host, svg, fr.length, show, spec);
}
const MOUNTS = { fraction: mountFraction, range: mountRange, tens: mountTens, line: mountLine, columns: mountColumns, bar: mountBar, array: mountArray };
function mount(host, spec){
  const api = (MOUNTS[spec.kind] || mountDots)(host, spec);
  host._demo = api; return api;
}
function mountDots(host, spec){
  const slots = spec.slots || 6, fr = frames(spec), P = 36, R = 15, H = 44;
  const hasBig = fr.some(f => f.big != null), width = Math.max(slots, 8) * P + 4;   // same width for every row, so dots match across cards
  host.textContent = "";
  const svg = el("svg", { viewBox: `0 0 ${width} ${H}`, role: "img", "aria-label": spec.alt || "Animation", preserveAspectRatio: "xMinYMid meet" }, host);
  const cells = [];
  for (let i = 0; i < slots; i++) {
    const cx = 2 + P / 2 + i * P, cy = H / 2;
    const c = el("circle", { class: "dm-c", cx, cy, r: R, "data-s": "off" }, svg);
    const t = el("text", { class: "dm-n", x: cx, y: cy + 1 }, svg);
    cells.push({ c, t });
  }
  const big = hasBig ? el("text", { class: "dm-big", x: width - 4, y: H / 2 + 14, "text-anchor": "end", opacity: 0 }, svg) : null;
  const show = f => {
    slotStates(f, slots).forEach((st, i) => { cells[i].c.setAttribute("data-s", st.s); cells[i].t.textContent = st.n; cells[i].t.setAttribute("data-k", st.s === "next" ? "next" : "num"); });
    if (big) { big.textContent = f.big == null ? "" : String(f.big); big.setAttribute("opacity", f.big == null ? 0 : 1); }
  };
  let timer = null, played = false;
  const stop = () => { clearTimeout(timer); timer = null; };
  const last = () => fr[fr.length - 1];
  let btn = null;
  const play = () => {
    stop(); played = true;
    if (calm() || fr.length < 2) { show(last()); return; }
    let i = 0; show(fr[0]);
    const step = () => { i++; if (i >= fr.length || !host.isConnected) return; show(fr[i]); timer = setTimeout(step, i === fr.length - 1 ? (spec.ms || 420) * 1.4 : (spec.ms || 420)); };
    timer = setTimeout(step, spec.ms || 420);
  };
  if (spec.hold) { show(fr[0]); let out = false;   // an Everyday task's picture waits without the numbers until it is solved
    return { replay: play, stop, goto: i => { stop(); show(fr[Math.max(0, Math.min(fr.length - 1, i))]); }, release: () => { if (out) return; out = true;
      if (!calm()) { btn = document.createElement("button"); btn.type = "button"; btn.className = "dm-replay"; btn.setAttribute("aria-label", "Replay the animation"); btn.textContent = "↻"; btn.addEventListener("click", play); host.appendChild(btn); svg.addEventListener("click", play); }
      play(); } }; }
  show(calm() ? last() : fr[0]);
  if (!calm()) {
    btn = document.createElement("button"); btn.type = "button"; btn.className = "dm-replay"; btn.setAttribute("aria-label", "Replay the animation"); btn.textContent = "↻";
    btn.addEventListener("click", play); host.appendChild(btn);
    svg.addEventListener("click", play);
    if (W.IntersectionObserver) {
      const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !played) { play(); io.disconnect(); } }, { threshold: 0.6 });
      io.observe(host);
    } else play();
  }
  return { replay: play, stop };
}
function mountAll(root){
  const out = [];
  root.querySelectorAll("[data-spec]").forEach(h => { try { out.push(mount(h, JSON.parse(h.getAttribute("data-spec")))); } catch (e) { console.error("InquireDemo", e); } });
  return out;
}
W.InquireDemo.mount = mount; W.InquireDemo.mountAll = mountAll;
})();
