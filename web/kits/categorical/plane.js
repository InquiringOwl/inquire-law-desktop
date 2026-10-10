/* ============ Categorical kit: plane (graphs, coordinate figures, draggable points) ============
   Shared by every subject that draws on axes (math, physics, economics…). Adds to every k (via LabKit.extend):
     k.plot(c, o)    bare coordinate plane: P.X P.Y P.inv P.grid P.axes P.fn P.line P.point P.label P.clip
     k.plane(c, o)   k.plot + starts below the mode buttons + P.curve (breaks), P.onCurve, P.vasym/hasym/asym, P.hole,
                     P.dot, P.param, P.implicit, P.shade, P.seg, P.handle, and P.labels (collision-free; call LAST)
     k.drag(c, () => P, pts, onMove, opt)   draggable points: mouse, touch AND keyboard (see below)
   window.PlaneRules (DOM-free, tested in tests/universal.test.js): niceStep, ticks, placeLabels, nearestOnCurve,
     projectToSegment, dragTarget.  MathRules keeps aliases (MR.niceStep, MR.ticks, MR.placeLabels).

   THE INTERACTION RULE (Precalculus onward): every point that defines a figure is a handle the learner can drag, and a
   point that belongs to a curve slides ALONG the curve. Constraints per point (all in math coordinates):
     {x, y, color, name,                    current position, handle colour, spoken name ("vertex", "focus F₁")
      snap | snapX | snapY,                 grid snapping (step); keyboard moves by the same step
      clamp: [xmin, xmax, ymin, ymax],      box the point must stay in (default: the visible window)
      fixX | fixY,                          slide only vertically / horizontally
      on: x => f(x),                        glued to the graph of f: x follows the pointer, y = f(x)
      path: (x, y) => ({x, y}),             any projection (circle, ray, segment, parametric curve…)
      off}                                  temporarily not draggable (still drawn by the lab if it wants)
   D = k.drag(…) → {active, hover, focus, draw(P)}: call D.draw(P) after drawing the figure (before P.labels) to paint
   every handle with its halo (hover/drag/keyboard focus rings). Keyboard: Tab into the canvas focuses the first
   handle, Tab/Shift+Tab move between handles, arrows move (Shift ×5), on/path points move along their constraint. */
(function(){
const W = typeof window !== "undefined" ? window : globalThis;

/* ---------------- DOM-free rules ---------------- */
function niceStep(span, target = 8){ const raw = span / target, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
function ticks(min, max, step){ step = step || niceStep(max - min); const out = []; for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10)); return out; }

/* Collision-free label placement (greedy). Each label: {x, y: anchor in px, w, h}. Options:
   bounds {x, y, w, h}; boxes: [{x, y, w, h}] to avoid (mode buttons, legends); pts: [[x, y], …] samples of curves/lines to avoid.
   Returns, per label, {x, y, w, h} (top-left of the text box), the chosen offset name and its cost (0 = clean). */
const OFFS = [["ne", 1, -1], ["nw", -1, -1], ["se", 1, 1], ["sw", -1, 1], ["e", 1, 0], ["w", -1, 0], ["n", 0, -1], ["s", 0, 1]];
function placeLabels(labels, o = {}){
  const placed = [], boxes = (o.boxes || []).slice(), pts = o.pts || [], B = o.bounds, gap = o.gap ?? 6;
  const ov = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return labels.map(L => {
    let best = null; const prefer = L.prefer ? [L.prefer] : [];
    const order = OFFS.slice().sort((a, b) => (prefer.includes(b[0]) - prefer.includes(a[0])));
    for (const ring of [gap, gap + 12, gap + 26]) for (const [name, sx, sy] of order) {
      const r = { x: sx > 0 ? L.x + ring : sx < 0 ? L.x - ring - L.w : L.x - L.w / 2, y: sy > 0 ? L.y + ring : sy < 0 ? L.y - ring - L.h : L.y - L.h / 2, w: L.w, h: L.h };
      let cost = 0;
      if (B) { const out = Math.max(0, B.x - r.x) + Math.max(0, r.x + r.w - B.x - B.w) + Math.max(0, B.y - r.y) + Math.max(0, r.y + r.h - B.y - B.h); cost += out * 50; }
      for (const p of placed) cost += ov(r, p) * 4;
      for (const b of boxes) cost += ov(r, b) * 4;
      for (const [px, py] of pts) if (px > r.x - 1 && px < r.x + r.w + 1 && py > r.y - 1 && py < r.y + r.h + 1) cost += 30;
      cost += (ring - gap) * 0.5 + order.findIndex(q => q[0] === name) * 0.05;
      if (!best || cost < best.cost) best = Object.assign(r, { name, cost: Math.round(cost * 100) / 100 });
      if (best.cost < 1) break;
    }
    placed.push(best); return best;
  });
}
// Closest point of segment AB to P (math coords): {x, y, t ∈ [0, 1]}
function projectToSegment(px, py, ax, ay, bx, by){ const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0; return { x: ax + t * dx, y: ay + t * dy, t }; }
// Closest point of a parametric curve (fx(t), fy(t)), t in [t0, t1], to (px, py), with scale sx, sy (px per unit) so
// "closest" is on screen. Coarse scan then golden refine. → {t, x, y}
function nearestOnCurve(fx, fy, t0, t1, px, py, sx = 1, sy = 1, n = 240){
  const d2 = t => { const x = fx(t), y = fy(t); if (!isFinite(x) || !isFinite(y)) return Infinity; return ((x - px) * sx) ** 2 + ((y - py) * sy) ** 2; };
  let bt = t0, bd = Infinity; for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, v = d2(t); if (v < bd) { bd = v; bt = t; } }
  let a = Math.max(t0, bt - (t1 - t0) / n), b = Math.min(t1, bt + (t1 - t0) / n); const g = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 40; i++) { const c = b - g * (b - a), e = a + g * (b - a); if (d2(c) < d2(e)) b = e; else a = c; }
  const t = (a + b) / 2; return { t, x: fx(t), y: fy(t) };
}
// Where a dragged point goes: pointer (mx, my) in math coords → constrained, snapped, clamped position. Pure, so the
// rules can be tested without a browser. p: the point's constraint object; win: [xmin, xmax, ymin, ymax].
function dragTarget(p, mx, my, win){
  const cl = p.clamp || win, sx = p.snapX ?? p.snap, sy = p.snapY ?? p.snap;
  const sn = (v, s) => (s ? +(Math.round(v / s) * s).toFixed(10) : v), cx = v => Math.max(cl[0], Math.min(cl[1], v)), cy = v => Math.max(cl[2], Math.min(cl[3], v));
  let x = mx, y = my;
  if (p.on) { x = cx(sn(x, sx)); y = p.on(x); if (!isFinite(y)) return null; return { x: +x.toFixed(6), y: +y.toFixed(9) }; }
  if (p.path) { const q = p.path(x, y); if (!q || !isFinite(q.x) || !isFinite(q.y)) return null; x = q.x; y = q.y; if (sx || sy) { const q2 = p.path(sn(x, sx), sn(y, sy)); if (q2 && isFinite(q2.x)) { x = q2.x; y = q2.y; } } return { x: +x.toFixed(9), y: +y.toFixed(9) }; }
  x = cx(sn(x, sx)); y = cy(sn(y, sy));
  return { x: p.fixX ? p.x : +x.toFixed(6), y: p.fixY ? p.y : +y.toFixed(6) };
}
W.PlaneRules = { niceStep, ticks, placeLabels, projectToSegment, nearestOnCurve, dragTarget };
if (typeof document === "undefined" || !W.LabKit || !W.LabKit.make) return;

/* ---------------- drawing ---------------- */
W.LabKit.extend(k => {
  const { C, F, alpha } = k;
  // Bare coordinate plane. Call inside a loop after c.begin().
  //   const P = k.plot(c, { xmin:-10, xmax:10, ymin:-10, ymax:10, pad:{l:40,r:16,t:16,b:30}, equal:false });
  k.plot = (c, o = {}) => {
    const d = c.d, g = c.g, pad = Object.assign({ l: 40, r: 16, t: 16, b: 30 }, o.pad || {});
    let { xmin = -10, xmax = 10, ymin = -10, ymax = 10 } = o;
    let Wd = c.w - pad.l - pad.r, H = c.h - pad.t - pad.b;
    if (o.equal) { const sx = Wd / (xmax - xmin), sy = H / (ymax - ymin), s = Math.min(sx, sy); const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2; xmin = cx - Wd / s / 2; xmax = cx + Wd / s / 2; ymin = cy - H / s / 2; ymax = cy + H / s / 2; }
    const X = x => pad.l + (x - xmin) / (xmax - xmin) * Wd, Y = y => pad.t + (ymax - y) / (ymax - ymin) * H;
    const P = { X, Y, xmin, xmax, ymin, ymax, left: pad.l, top: pad.t, width: Wd, height: H,
      inv: (px, py) => ({ x: xmin + (px - pad.l) / Wd * (xmax - xmin), y: ymax - (py - pad.t) / H * (ymax - ymin) }),
      grid(step){ const sx = step || o.xstep || niceStep(xmax - xmin), sy = step || o.ystep || niceStep(ymax - ymin); g.save(); g.strokeStyle = alpha(C.line2, .45); g.lineWidth = 1; g.beginPath();
        for (let x = Math.ceil(xmin / sx) * sx; x <= xmax + 1e-9; x += sx) { g.moveTo(Math.round(X(x)) + .5, pad.t); g.lineTo(Math.round(X(x)) + .5, pad.t + H); }
        for (let y = Math.ceil(ymin / sy) * sy; y <= ymax + 1e-9; y += sy) { g.moveTo(pad.l, Math.round(Y(y)) + .5); g.lineTo(pad.l + Wd, Math.round(Y(y)) + .5); } g.stroke(); g.restore(); },
      axes(labels = true){ const sx = o.xstep || niceStep(xmax - xmin), sy = o.ystep || niceStep(ymax - ymin);
        const ax = Math.min(Math.max(0, ymin), ymax), ay = Math.min(Math.max(0, xmin), xmax);
        d.line(pad.l, Y(ax), pad.l + Wd, Y(ax), C.muted, 1.5); d.line(X(ay), pad.t, X(ay), pad.t + H, C.muted, 1.5);
        if (!labels) return;
        const f = v => (Math.abs(v) < 1e-9 ? "0" : String(+v.toFixed(6))).replace("-", "−");
        for (let x = Math.ceil(xmin / sx) * sx; x <= xmax + 1e-9; x += sx) { if (Math.abs(x) < 1e-9) continue; d.line(X(x), Y(ax) - 4, X(x), Y(ax) + 4, C.muted); d.text(f(x), X(x), Math.min(pad.t + H + 16, Y(ax) + 16), { font: `11px ${F.mono}`, color: C.faint, align: "center" }); }
        for (let y = Math.ceil(ymin / sy) * sy; y <= ymax + 1e-9; y += sy) { if (Math.abs(y) < 1e-9) continue; d.line(X(ay) - 4, Y(y), X(ay) + 4, Y(y), C.muted); d.text(f(y), Math.max(pad.l - 6, X(ay) - 7), Y(y), { font: `11px ${F.mono}`, color: C.faint, align: "right", base: "middle" }); }
        if (o.xlabel) d.text(o.xlabel, pad.l + Wd, Y(ax) - 8, { font: `italic 14px ${F.math}`, color: C.muted, align: "right" });
        if (o.ylabel) d.text(o.ylabel, X(ay) + 8, pad.t + 12, { font: `italic 14px ${F.math}`, color: C.muted }); },
      clip(fn){ g.save(); g.beginPath(); g.rect(pad.l, pad.t, Wd, H); g.clip(); fn(); g.restore(); },
      fn(f, color = C.amber, w = 2.5, from = xmin, to = xmax, dash){ g.save(); g.beginPath(); g.rect(pad.l, pad.t, Wd, H); g.clip(); g.strokeStyle = color; g.lineWidth = w; if (dash) g.setLineDash(dash); g.beginPath(); let pen = false, prev = null;
        const N = Math.max(200, Math.round(Wd)); for (let i = 0; i <= N; i++) { const x = from + (to - from) * i / N, y = f(x); if (!isFinite(y) || (prev !== null && Math.abs(Y(y) - Y(prev)) > H * 2)) { pen = false; prev = isFinite(y) ? y : null; continue; } const px = X(x), py = Y(y); pen ? g.lineTo(px, py) : g.moveTo(px, py); pen = true; prev = y; } g.stroke(); g.restore(); },
      line(x1, y1, x2, y2, color, w = 2, dash){ P.clip(() => d.line(X(x1), Y(y1), X(x2), Y(y2), color, w, dash)); },
      point(x, y, color = C.amber, r = 6, open = false){ if (open) d.circle(X(x), Y(y), r, C.ink, color, 2); else d.circle(X(x), Y(y), r, color); },
      label(s, x, y, color = C.text, opt = {}){ d.text(s, X(x) + (opt.dx || 8), Y(y) + (opt.dy || -8), { font: opt.font || `14px ${F.math}`, color, align: opt.align || "left", base: opt.base }); }
    };
    return P;
  };

  // Coordinate plane: everything k.plot does, plus the helpers below. Call inside the loop after c.begin().
  k.plane = (c, o = {}) => {
    const mb = k.stage.querySelector(".modes"); if (mb && o.modes !== false) { const top = mb.offsetTop + mb.offsetHeight + 6; o = Object.assign({}, o, { pad: Object.assign({ l: 40, r: 16, t: 16, b: 30 }, o.pad || {}) }); o.pad.t = Math.max(o.pad.t, top); }
    const P = k.plot(c, o), d = c.d, g = c.g;
    // boxes and curve samples are shared by every plane drawn on this canvas in the same frame (reset by c.begin)
    if (!c.__mkWrap) { const b0 = c.begin; c.begin = () => { c.__mk = { boxes: [], pts: [] }; b0(); }; c.__mkWrap = true; c.__mk = { boxes: [], pts: [] }; }
    P.pts = c.__mk.pts; P.boxes = c.__mk.boxes; P.boxes.push(...(o.avoid || []));
    c.__P = P;
    const axes0 = P.axes;
    P.axes = (labels = true) => { axes0(labels); if (!labels) return;
      const sx = o.xstep || niceStep(P.xmax - P.xmin), sy = o.ystep || niceStep(P.ymax - P.ymin), tf = `11px ${F.mono}`, nf = `italic 14px ${F.math}`;
      const ax = Math.min(Math.max(0, P.ymin), P.ymax), ay = Math.min(Math.max(0, P.xmin), P.xmax), f = v => (Math.abs(v) < 1e-9 ? "0" : String(+v.toFixed(6))).replace("-", "−");
      for (let x = Math.ceil(P.xmin / sx) * sx; x <= P.xmax + 1e-9; x += sx) { if (Math.abs(x) < 1e-9) continue; const w = d.width(f(x), tf), y = Math.min(P.top + P.height + 16, P.Y(ax) + 16); P.boxes.push({ x: P.X(x) - w / 2 - 2, y: y - 11, w: w + 4, h: 15 }); }
      for (let y = Math.ceil(P.ymin / sy) * sy; y <= P.ymax + 1e-9; y += sy) { if (Math.abs(y) < 1e-9) continue; const w = d.width(f(y), tf), xr = Math.max(P.left - 6, P.X(ay) - 7); P.boxes.push({ x: xr - w - 2, y: P.Y(y) - 8, w: w + 4, h: 16 }); }
      if (o.xlabel) { const w = d.width(o.xlabel, nf); P.boxes.push({ x: P.left + P.width - w - 2, y: P.Y(ax) - 24, w: w + 4, h: 19 }); }
      if (o.ylabel) { const w = d.width(o.ylabel, nf); P.boxes.push({ x: P.X(ay) + 6, y: P.top - 3, w: w + 4, h: 19 }); } };
    const record = (x, y) => { if (x >= P.left && x <= P.left + P.width && y >= P.top && y <= P.top + P.height) P.pts.push([x, y]); };
    P.record = record;
    if (mb && o.modes !== false) { const r = mb.getBoundingClientRect(), s = c.cv.getBoundingClientRect(); P.boxes.push({ x: r.left - s.left - 4, y: r.top - s.top - 4, w: r.width + 8, h: r.height + 8 }); }
    // y = f(x) with breaks at given x values (vertical asymptotes / excluded points). opts: breaks, from, to, dash, w
    P.curve = (f, color = C.amber, opt = {}) => {
      const from = opt.from ?? P.xmin, to = opt.to ?? P.xmax, brk = (opt.breaks || []).filter(b => b > from && b < to).sort((a, b) => a - b);
      const cuts = [from, ...brk, to], eps = (P.xmax - P.xmin) * 1e-4;
      for (let i = 0; i < cuts.length - 1; i++) { const a = i ? cuts[i] + eps : cuts[i], b = i < cuts.length - 2 ? cuts[i + 1] - eps : cuts[i + 1]; if (b > a) P.fn(f, color, opt.w || 2.5, a, b, opt.dash); }
      const N = 120; for (let i = 0; i <= N; i++) { const x = from + (to - from) * i / N, y = f(x); if (isFinite(y)) record(P.X(x), P.Y(y)); }
    };
    // A point of y = f(x) inside the window (away from the edges), searched outward from the fraction `at` of [lo, hi].
    P.onCurve = (f, at = 0.85, lo = -Infinity, hi = Infinity) => { lo = Math.max(lo, P.xmin); hi = Math.min(hi, P.xmax); const my = (P.ymax - P.ymin) * 0.08;
      for (let i = 0; i <= 60; i++) { const sft = (i % 2 ? -1 : 1) * Math.ceil(i / 2) / 60, x = lo + (hi - lo) * Math.min(1, Math.max(0, at + sft)), y = f(x); if (isFinite(y) && y > P.ymin + my && y < P.ymax - my) return { x, y }; } return null; };
    P.vasym = (x, color = C.violet, w = 1.5) => { P.line(x, P.ymin, x, P.ymax, color, w, [6, 5]); for (let i = 0; i <= 20; i++) record(P.X(x), P.top + P.height * i / 20); };
    P.hasym = (y, color = C.violet, w = 1.5) => { P.line(P.xmin, y, P.xmax, y, color, w, [6, 5]); for (let i = 0; i <= 30; i++) record(P.left + P.width * i / 30, P.Y(y)); };
    P.asym = (f, color = C.violet, w = 1.5) => P.curve(f, color, { w, dash: [6, 5] });
    P.hole = (x, y, color = C.amber, r = 5) => { if (x >= P.xmin && x <= P.xmax && y >= P.ymin && y <= P.ymax) { d.circle(P.X(x), P.Y(y), r, C.ink, color, 2); record(P.X(x), P.Y(y)); } };
    P.dot = (x, y, color = C.amber, r = 5.5) => { if (x >= P.xmin && x <= P.xmax && y >= P.ymin && y <= P.ymax) { P.point(x, y, color, r); record(P.X(x), P.Y(y)); } };
    // Parametric curve (x(t), y(t)) for t in [t0, t1]
    P.param = (fx, fy, t0, t1, color = C.amber, w = 2.5, dash) => { P.clip(() => { g.save(); g.strokeStyle = color; g.lineWidth = w; if (dash) g.setLineDash(dash); g.beginPath(); const N = 360; let pen = false; for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N, x = fx(t), y = fy(t); if (!isFinite(x) || !isFinite(y)) { pen = false; continue; } const px = P.X(x), py = P.Y(y); pen ? g.lineTo(px, py) : g.moveTo(px, py); pen = true; if (i % 6 === 0) record(px, py); } g.stroke(); g.restore(); }); };
    // Implicit curve G(x, y) = 0 (conics, nonlinear systems) by marching squares on a cell grid of `res` px.
    P.implicit = (G, color = C.amber, w = 2.5, res = 5) => { P.clip(() => { g.save(); g.strokeStyle = color; g.lineWidth = w; g.lineCap = "round"; g.beginPath();
      const nx = Math.ceil(P.width / res), ny = Math.ceil(P.height / res), val = [];
      for (let j = 0; j <= ny; j++) { const row = []; for (let i = 0; i <= nx; i++) { const q = P.inv(P.left + i * res, P.top + j * res); row.push(G(q.x, q.y)); } val.push(row); }
      const lerpT = (a, b) => (a === b ? .5 : a / (a - b));
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const v0 = val[j][i], v1 = val[j][i + 1], v2 = val[j + 1][i + 1], v3 = val[j + 1][i]; const x0 = P.left + i * res, y0 = P.top + j * res;
        const e = []; if ((v0 > 0) !== (v1 > 0)) e.push([x0 + res * lerpT(v0, v1), y0]); if ((v1 > 0) !== (v2 > 0)) e.push([x0 + res, y0 + res * lerpT(v1, v2)]);
        if ((v3 > 0) !== (v2 > 0)) e.push([x0 + res * lerpT(v3, v2), y0 + res]); if ((v0 > 0) !== (v3 > 0)) e.push([x0, y0 + res * lerpT(v0, v3)]);
        if (e.length >= 2 && [v0, v1, v2, v3].every(isFinite)) { g.moveTo(e[0][0], e[0][1]); g.lineTo(e[1][0], e[1][1]); record(e[0][0], e[0][1]); if (e.length === 4) { g.moveTo(e[2][0], e[2][1]); g.lineTo(e[3][0], e[3][1]); } }
      } g.stroke(); g.restore(); }); };
    // Shade between y = f and y = h (h defaults to the x-axis) for x in [from, to]
    P.shade = (f, h, from, to, color) => { h = h || (() => 0); P.clip(() => { g.save(); g.fillStyle = color; g.beginPath(); const N = 160; for (let i = 0; i <= N; i++) { const x = from + (to - from) * i / N; const y = Math.max(P.ymin - 1e3, Math.min(P.ymax + 1e3, f(x))); i ? g.lineTo(P.X(x), P.Y(y)) : g.moveTo(P.X(x), P.Y(y)); } for (let i = N; i >= 0; i--) { const x = from + (to - from) * i / N; const y = Math.max(P.ymin - 1e3, Math.min(P.ymax + 1e3, h(x))); g.lineTo(P.X(x), P.Y(y)); } g.closePath(); g.fill(); g.restore(); }); };
    P.seg = (x1, y1, x2, y2, color, w = 2, dash) => { P.line(x1, y1, x2, y2, color, w, dash); for (let i = 0; i <= 10; i++) record(P.X(x1 + (x2 - x1) * i / 10), P.Y(y1 + (y2 - y1) * i / 10)); };
    // A draggable handle at (x, y): filled dot, ring, and a halo when hovered/dragged/focused. state: {hover, active, focus}
    P.handle = (x, y, color = C.amber, st = {}) => { if (!(x >= P.xmin && x <= P.xmax && y >= P.ymin && y <= P.ymax)) return; const px = P.X(x), py = P.Y(y);
      if (st.active || st.hover) d.circle(px, py, st.active ? 17 : 14, alpha(color, st.active ? .22 : .14));
      if (st.focus) { g.save(); g.setLineDash([3, 3]); d.circle(px, py, 13, null, color, 1.5); g.restore(); }
      d.circle(px, py, 7, C.ink, color, 2.2); d.circle(px, py, 3.6, color); record(px, py); P.boxes.push({ x: px - 9, y: py - 9, w: 18, h: 18 }); };
    // Labels placed so they don't overlap each other, curves drawn so far, the mode buttons or the plot edges.
    // list: [{text, x, y (math coords), color, font, prefer: "ne"|"nw"|…}] — draw these LAST in the frame.
    P.labels = list => {
      const items = list.filter(l => l && l.x >= P.xmin && l.x <= P.xmax && l.y >= P.ymin && l.y <= P.ymax).map(l => { const font = l.font || `14px ${F.math}`; return Object.assign({}, l, { font, ax: P.X(l.x), ay: P.Y(l.y), w: d.width(l.text, font) + 2, h: parseInt(/(\d+)px/.exec(font)[1], 10) + 4 }); });
      const res = placeLabels(items.map(l => ({ x: l.ax, y: l.ay, w: l.w, h: l.h, prefer: l.prefer })), { bounds: { x: P.left, y: P.top, w: P.width, h: P.height }, boxes: P.boxes, pts: P.pts });
      items.forEach((l, i) => { const r = res[i]; if (l.halo !== false) d.rect(r.x - 1, r.y, r.w + 2, r.h, alpha(C.ink, .72)); d.text(l.text, r.x + 1, r.y + r.h / 2, { font: l.font, color: l.color || C.text, base: "middle" }); P.boxes.push(r); });
      return res;
    };
    return P;
  };

  // Draggable points (mouse, touch, keyboard). See the header for the constraint fields.
  k.drag = (c, getP, pts, onMove, opt = {}) => {
    const st = { active: -1, hover: -1, focus: -1, pts }, R = opt.r || (k.coarse ? 24 : 16);
    const win = P => [P.xmin, P.xmax, P.ymin, P.ymax];
    const usable = i => pts[i] && !pts[i].off;
    const hit = e => { const P = getP(); if (!P) return -1; const q = c.xy(e); let best = -1, bd = R; pts.forEach((p, i) => { if (!usable(i)) return; const dd = Math.hypot(P.X(p.x) - q.x, P.Y(p.y) - q.y); if (dd < bd) { bd = dd; best = i; } }); return best; };
    const apply = (i, mx, my) => { const P = getP(), p = pts[i]; if (!P || !p) return; const t = dragTarget(p, mx, my, win(P)); if (!t) return; if (t.x === p.x && t.y === p.y) return; p.x = t.x; p.y = t.y; if (onMove) onMove(i, p); say(i); };
    const move = e => { const P = getP(); if (!P || st.active < 0) return; const q = c.xy(e), m = P.inv(q.x, q.y); apply(st.active, m.x, m.y); };
    const name = i => pts[i].name || (pts.length > 1 ? `point ${i + 1}` : "the point");
    const num = v => String(+(+v).toFixed(3)).replace("-", "−");
    let sayT = 0; const say = i => { const now = performance.now(); if (now - sayT < 120 && st.active >= 0) return; sayT = now; c.cv.setAttribute("aria-label", `${opt.label || "Graph"}: ${name(i)} at (${num(pts[i].x)}, ${num(pts[i].y)}). Tab to choose a point, arrow keys to move it.`); };
    if (!c.cv.hasAttribute("tabindex")) c.cv.tabIndex = 0;
    c.cv.setAttribute("role", "application");
    if (!c.cv.getAttribute("aria-label")) c.cv.setAttribute("aria-label", `${opt.label || "Graph"} with ${pts.length} draggable point${pts.length > 1 ? "s" : ""}. Drag them, or Tab to a point and use the arrow keys.`);
    k.listen(c.cv, "pointerdown", e => { const i = hit(e); if (i < 0) return; st.active = i; c.cv.style.cursor = "grabbing"; try { c.cv.setPointerCapture(e.pointerId); } catch (_) {} move(e); e.preventDefault(); });
    k.listen(c.cv, "pointermove", e => { if (st.active >= 0) move(e); else { const h = hit(e); if (h !== st.hover) { st.hover = h; } c.cv.style.cursor = st.hover >= 0 ? "grab" : ""; } });
    const up = () => { if (st.active >= 0) c.cv.style.cursor = "grab"; st.active = -1; };
    k.listen(c.cv, "pointerup", up); k.listen(c.cv, "pointercancel", up); k.listen(c.cv, "pointerleave", () => { if (st.active < 0) st.hover = -1; });
    c.cv.style.touchAction = "none";
    const firstUsable = (from, dir) => { for (let i = from; i >= 0 && i < pts.length; i += dir) if (usable(i)) return i; return -1; };
    k.listen(c.cv, "focus", () => { if (st.focus < 0) st.focus = firstUsable(0, 1); if (st.focus >= 0) say(st.focus); });
    k.listen(c.cv, "blur", () => { st.focus = -1; });
    k.listen(c.cv, "keydown", e => { if (st.focus < 0 || !pts[st.focus]) return; const P = getP(); if (!P) return;
      if (e.key === "Tab") { const n = firstUsable(st.focus + (e.shiftKey ? -1 : 1), e.shiftKey ? -1 : 1); if (n >= 0) { st.focus = n; say(n); e.preventDefault(); } return; }
      const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }, dv = dirs[e.key]; if (!dv) return; e.preventDefault();
      const p = pts[st.focus], mul = e.shiftKey ? 5 : 1;
      const sx = p.keyStep || p.snapX || p.snap || niceStep(P.xmax - P.xmin, 40), sy = p.keyStep || p.snapY || p.snap || niceStep(P.ymax - P.ymin, 40);
      if (p.on) { const s = (dv[0] || dv[1]) * sx * mul; apply(st.focus, p.x + s, p.y); return; }
      if (p.path) { // step along the constraint: try a small move in the arrow's direction, then project
        let tx = p.x + dv[0] * sx * mul, ty = p.y + dv[1] * sy * mul; const q = p.path(tx, ty);
        if (q && Math.hypot(q.x - p.x, q.y - p.y) < 1e-9) { tx = p.x + (dv[0] || dv[1]) * sx * mul; ty = p.y + (dv[1] || -dv[0]) * sy * mul; }
        apply(st.focus, tx, ty); return; }
      apply(st.focus, p.x + dv[0] * sx * mul, p.y + dv[1] * sy * mul); });
    // Paint every handle with its state ring. Call after the figure, before P.labels.
    st.draw = (P, colors) => { P = P || getP(); if (!P || !P.handle) return; const focused = document.activeElement === c.cv; pts.forEach((p, i) => { if (p.off || p.hidden) return; P.handle(p.x, p.y, (colors && colors[i]) || p.color || C.amber, { hover: st.hover === i, active: st.active === i, focus: focused && st.focus === i }); }); };
    return st;
  };
});
})();
