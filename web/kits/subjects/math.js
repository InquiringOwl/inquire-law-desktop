/* ============ Subject kit: Mathematics (Algebra II onward; usable by any math/physics lab) ============
   Loaded after web/kits/universal and web/kits/categorical (it uses PlaneRules and LabKit.reveal).
   1. window.MathRules (MR): pure, DOM-free rules: exact rationals, polynomials (division, synthetic division,
      rational roots, real/complex roots), exact complex numbers, radicals and exact quadratic roots, rational-function
      features (holes, asymptotes, zeros), transformations, logs, sequences and series, binomial coefficients,
      conic sections from general form, numeric zeros/intersections and formatters; and (Algebra II → Precalculus) exact
      interval sets (MR.RS), sign charts and inequalities, factored/vertex/standard-form text, turning points, linear and
      conic systems, variation, exp/log helpers and drills, sequence/series helpers. MR.niceStep/ticks/placeLabels are
      PlaneRules (categorical plane kit); MR.reveal is LabKit.reveal (stepper kit).
      Tested in tests/math.test.js (node tools/labtest.js math). Put any new rule a lab needs HERE, with a test.
   2. window.MathKit.attach(k): k.MR, k.cplane (complex plane), k.synthHTML. Everything else a math lab draws with now
      comes with every k from the universal/categorical kits (k.plane, k.drag, k.vars, k.params, k.split, k.group,
      k.smooth, k.stepsPanel, k.readout, k.guard, k.hint, k.eqline); attach is still called first by every math lab.
   API summary and lab archetypes: docs/subjects/MATH.md (+ docs/universal, docs/categorical). */
(function(){
const W = window;
const MI = "−";

/* ---------------- 1. MathRules ---------------- */
const gcdI = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const lcmI = (a, b) => (a && b ? Math.abs(a * b) / gcdI(a, b) : 0);

// Exact rationals. Q(3), Q(3, 4), Q(0.75) (decimals → nearest fraction with denominator ≤ 10⁶), Q({n, d}).
function Q(n, d = 1){
  if (n && typeof n === "object") return n.isQ ? n : Q(n.n, n.d);
  if (!Number.isInteger(n) || !Number.isInteger(d)) { if (d !== 1) return Q.div(Q(n), Q(d)); return fromDec(n); }
  if (d === 0) throw new Error("MathRules.Q: zero denominator");
  if (d < 0) { n = -n; d = -d; }
  const g = gcdI(n, d) || 1;
  return Object.freeze({ isQ: true, n: n / g + 0, d: d / g, toString(){ return this.d === 1 ? String(this.n) : this.n + "/" + this.d; } });
}
function fromDec(x){
  if (!isFinite(x)) throw new Error("MathRules.Q: not finite");
  let h0 = 0, h1 = 1, k0 = 1, k1 = 0, v = Math.abs(x);
  for (let i = 0; i < 40; i++) { const a = Math.floor(v); [h0, h1] = [h1, a * h1 + h0]; [k0, k1] = [k1, a * k1 + k0]; if (k1 > 1e6) { h1 = h0; k1 = k0; break; } if (Math.abs(h1 / k1 - Math.abs(x)) < 1e-12) break; v = 1 / (v - a); if (!isFinite(v)) break; }
  return Q(x < 0 ? -h1 : h1, k1);
}
Q.add = (a, b) => { a = Q(a); b = Q(b); return Q(a.n * b.d + b.n * a.d, a.d * b.d); };
Q.sub = (a, b) => { a = Q(a); b = Q(b); return Q(a.n * b.d - b.n * a.d, a.d * b.d); };
Q.mul = (a, b) => { a = Q(a); b = Q(b); return Q(a.n * b.n, a.d * b.d); };
Q.div = (a, b) => { a = Q(a); b = Q(b); if (b.n === 0) throw new Error("MathRules.Q.div: division by zero"); return Q(a.n * b.d, a.d * b.n); };
Q.neg = a => { a = Q(a); return Q(-a.n, a.d); };
Q.inv = a => Q.div(1, a);
Q.pow = (a, e) => { a = Q(a); if (e < 0) return Q.pow(Q.inv(a), -e); let r = Q(1); for (let i = 0; i < e; i++) r = Q.mul(r, a); return r; };
Q.eq = (a, b) => { a = Q(a); b = Q(b); return a.n === b.n && a.d === b.d; };
Q.cmp = (a, b) => { a = Q(a); b = Q(b); return Math.sign(a.n * b.d - b.n * a.d); };
Q.lt = (a, b) => Q.cmp(a, b) < 0;
Q.val = a => { a = Q(a); return a.n / a.d; };
Q.isInt = a => Q(a).d === 1;
Q.zero = a => Q(a).n === 0;
Q.abs = a => { a = Q(a); return Q(Math.abs(a.n), a.d); };

/* Polynomials: arrays of Q, lowest degree first. Poly([1, 0, -2]) = 1 − 2x². */
const Poly = cs => trim(cs.map(c => Q(c)));
function trim(p){ p = p.slice(); while (p.length > 1 && p[p.length - 1].n === 0) p.pop(); return p.length ? p : [Q(0)]; }
Poly.deg = p => (p.length === 1 && p[0].n === 0 ? -Infinity : p.length - 1);
Poly.lead = p => p[p.length - 1];
Poly.isZero = p => p.length === 1 && p[0].n === 0;
Poly.add = (a, b) => { const r = []; for (let i = 0; i < Math.max(a.length, b.length); i++) r.push(Q.add(a[i] || 0, b[i] || 0)); return trim(r); };
Poly.sub = (a, b) => { const r = []; for (let i = 0; i < Math.max(a.length, b.length); i++) r.push(Q.sub(a[i] || 0, b[i] || 0)); return trim(r); };
Poly.scale = (a, k) => trim(a.map(c => Q.mul(c, k)));
Poly.mul = (a, b) => { const r = Array.from({ length: a.length + b.length - 1 }, () => Q(0)); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] = Q.add(r[i + j], Q.mul(x, y)); })); return trim(r); };
Poly.pow = (a, e) => { let r = Poly([1]); for (let i = 0; i < e; i++) r = Poly.mul(r, a); return r; };
Poly.eval = (p, x) => p.reduceRight((acc, c) => Q.add(Q.mul(acc, x), c), Q(0));
Poly.evalN = (p, x) => p.reduceRight((acc, c) => acc * x + c.n / c.d, 0);
Poly.fn = p => x => Poly.evalN(p, x);
Poly.deriv = p => trim(p.slice(1).map((c, i) => Q.mul(c, i + 1)).concat(p.length === 1 ? [Q(0)] : []));
Poly.fromRoots = (roots, lead = 1) => roots.reduce((p, r) => Poly.mul(p, [Q.neg(r), Q(1)]), Poly([lead]));
Poly.compose = (f, g) => f.reduceRight((acc, c) => Poly.add(Poly.mul(acc, g), [c]), Poly([0]));
Poly.eq = (a, b) => a.length === b.length && a.every((c, i) => Q.eq(c, b[i]));
// Long division: a = b·q + r with deg r < deg b.
Poly.divmod = (a, b) => {
  if (Poly.isZero(b)) throw new Error("MathRules.Poly.divmod: division by the zero polynomial");
  let r = a.slice(); const q = Array.from({ length: Math.max(1, a.length - b.length + 1) }, () => Q(0)), steps = [];
  while (Poly.deg(r) >= Poly.deg(b) && !Poly.isZero(r)) {
    const sh = r.length - b.length, c = Q.div(Poly.lead(r), Poly.lead(b)); q[sh] = c;
    const sub = Array(sh).fill(Q(0)).concat(b.map(x => Q.mul(x, c)));
    steps.push({ term: { c, e: sh }, sub: trim(sub) });
    r = Poly.sub(r, sub);
  }
  return { q: trim(q), r: trim(r), steps };
};
// Synthetic division by (x − r): top = coefficients high→low, mid = carried products, bottom = results; rem = p(r).
Poly.synth = (p, r) => {
  r = Q(r); const top = p.slice().reverse(), mid = [null], bottom = [top[0]];
  for (let i = 1; i < top.length; i++) { const m = Q.mul(bottom[i - 1], r); mid.push(m); bottom.push(Q.add(top[i], m)); }
  const rem = bottom[bottom.length - 1];
  return { top, mid, bottom, rem, q: trim(bottom.slice(0, -1).reverse().length ? bottom.slice(0, -1).reverse() : [Q(0)]) };
};
Poly.gcd = (a, b) => { while (!Poly.isZero(b)) [a, b] = [b, Poly.divmod(a, b).r]; return Poly.isZero(a) ? a : Poly.scale(a, Q.inv(Poly.lead(a))); };
// Integer multiple with coprime integer coefficients (clears denominators).
Poly.primitive = p => { const L = p.reduce((m, c) => lcmI(m, c.d), 1), ints = p.map(c => c.n * (L / c.d)), g = ints.reduce((m, x) => gcdI(m, x), 0) || 1; return ints.map(x => x / g); };
const divisors = n => { n = Math.abs(n); const r = []; for (let i = 1; i * i <= n; i++) if (n % i === 0) { r.push(i); if (i * i !== n) r.push(n / i); } return r.sort((a, b) => a - b); };
// Rational Root Theorem candidates ±p/q (p | constant, q | leading), sorted, after removing x = 0 roots.
Poly.ratCandidates = p => {
  let ints = Poly.primitive(p); while (ints.length > 1 && ints[0] === 0) ints = ints.slice(1);
  if (ints.length < 2) return [];
  const ps = divisors(ints[0]), qs = divisors(ints[ints.length - 1]), seen = new Map();
  for (const a of ps) for (const b of qs) for (const s of [1, -1]) { const v = Q(s * a, b); seen.set(v.toString(), v); }
  return [...seen.values()].sort(Q.cmp);
};
// Rational roots with multiplicity, and the deflated rest: p = lead·Π(x − r)^m · rest.
Poly.ratRoots = p => {
  let rest = p.slice(); const roots = [];
  let m0 = 0; while (rest.length > 1 && rest[0].n === 0) { rest = rest.slice(1); m0++; }
  if (m0) roots.push({ r: Q(0), m: m0 });
  for (const c of Poly.ratCandidates(rest)) { let m = 0; while (Poly.deg(rest) >= 1 && Poly.eval(rest, c).n === 0) { rest = Poly.synth(rest, c).q; m++; } if (m) roots.push({ r: c, m }); }
  roots.sort((a, b) => Q.cmp(a.r, b.r));
  return { roots, rest };
};
// All complex roots, numerically (Durand–Kerner). Returns [{re, im}], real ones first by value.
Poly.roots = p => {
  const n = Poly.deg(p); if (n < 1) return [];
  const a = p.map(c => c.n / c.d), L = a[n], c = a.map(x => x / L);
  let z = Array.from({ length: n }, (_, k) => cpow({ re: .4, im: .9 }, k));
  const ev = x => { let r = { re: 1, im: 0 }; for (let i = n - 1; i >= 0; i--) r = cadd(cmul(r, x), { re: c[i], im: 0 }); return r; };
  for (let it = 0; it < 500; it++) { let delta = 0; z = z.map((zi, i) => { let den = { re: 1, im: 0 }; z.forEach((zj, j) => { if (j !== i) den = cmul(den, csub(zi, zj)); }); const step = cdiv(ev(zi), den); delta = Math.max(delta, Math.hypot(step.re, step.im)); return csub(zi, step); }); if (delta < 1e-14) break; }
  z = z.map(w => ({ re: Math.abs(w.re) < 1e-10 ? 0 : w.re, im: Math.abs(w.im) < 1e-8 ? 0 : w.im }));
  return z.sort((u, v) => (u.im !== 0) - (v.im !== 0) || u.re - v.re || u.im - v.im);
};
// Real roots with multiplicity: exact where rational ({x, q: Q, m}), numeric otherwise ({x, q: null, m}). Sorted by x.
Poly.realRoots = p => {
  if (Poly.deg(p) < 1) return [];
  const { roots, rest } = Poly.ratRoots(p), out = roots.map(o => ({ x: Q.val(o.r), q: o.r, m: o.m }));
  if (Poly.deg(rest) >= 1) {
    const nr = Poly.roots(rest).filter(z => z.im === 0).map(z => z.re).sort((a, b) => a - b);
    for (const x of nr) { const last = out.find(o => o.q === null && Math.abs(o.x - x) < 1e-6); if (last) last.m++; else out.push({ x: polish(rest, x), q: null, m: 1 }); }
  }
  return out.sort((a, b) => a.x - b.x);
};
function polish(p, x){ const f = Poly.fn(p), d = Poly.fn(Poly.deriv(p)); for (let i = 0; i < 30; i++) { const dv = d(x); if (!dv) break; const nx = x - f(x) / dv; if (!isFinite(nx) || Math.abs(nx - x) < 1e-15) break; x = nx; } return x; }
// End behaviour: signs of p(x) as x → −∞ and x → +∞.
Poly.ends = p => { const n = Poly.deg(p), s = Math.sign(Q.val(Poly.lead(p))); return { left: n % 2 === 0 ? s : -s, right: s }; };
Poly.turningMax = p => Math.max(0, Poly.deg(p) - 1);

/* complex numbers, numeric (internal for root finding) */
const cadd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im }), csub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
const cmul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; };
const cpow = (a, k) => { let r = { re: 1, im: 0 }; for (let i = 0; i < k; i++) r = cmul(r, a); return r; };

/* Exact complex numbers a + bi with rational parts. Z(3, -4), Z(Q(1,2), 2). */
function Z(re, im = 0){ if (re && re.isZ) return re; return Object.freeze({ isZ: true, re: Q(re), im: Q(im) }); }
Z.add = (a, b) => { a = Z(a); b = Z(b); return Z(Q.add(a.re, b.re), Q.add(a.im, b.im)); };
Z.sub = (a, b) => { a = Z(a); b = Z(b); return Z(Q.sub(a.re, b.re), Q.sub(a.im, b.im)); };
Z.mul = (a, b) => { a = Z(a); b = Z(b); return Z(Q.sub(Q.mul(a.re, b.re), Q.mul(a.im, b.im)), Q.add(Q.mul(a.re, b.im), Q.mul(a.im, b.re))); };
Z.conj = a => { a = Z(a); return Z(a.re, Q.neg(a.im)); };
Z.neg = a => { a = Z(a); return Z(Q.neg(a.re), Q.neg(a.im)); };
Z.norm = a => { a = Z(a); return Q.add(Q.mul(a.re, a.re), Q.mul(a.im, a.im)); };   // |a|², exact
Z.div = (a, b) => { const n = Z.norm(b); if (n.n === 0) throw new Error("MathRules.Z.div: division by zero"); const t = Z.mul(a, Z.conj(b)); return Z(Q.div(t.re, n), Q.div(t.im, n)); };
Z.pow = (a, e) => { if (e < 0) return Z.pow(Z.div(1, a), -e); let r = Z(1); for (let i = 0; i < e; i++) r = Z.mul(r, a); return r; };
Z.ipow = e => [Z(1), Z(0, 1), Z(-1), Z(0, -1)][((e % 4) + 4) % 4];
Z.eq = (a, b) => { a = Z(a); b = Z(b); return Q.eq(a.re, b.re) && Q.eq(a.im, b.im); };
Z.abs = a => Math.sqrt(Q.val(Z.norm(a)));
Z.arg = a => { a = Z(a); return Math.atan2(Q.val(a.im), Q.val(a.re)); };
Z.val = a => { a = Z(a); return { re: Q.val(a.re), im: Q.val(a.im) }; };

/* Radicals and exact quadratic roots */
// √n = s√t with t square-free (n ≥ 0 integer).  sqrtParts(72) = [6, 2]
function sqrtParts(n){ if (n < 0) throw new Error("MathRules.sqrtParts: negative"); let s = 1, t = n; for (let f = 2; f * f <= t; f++) while (t % (f * f) === 0) { t /= f * f; s *= f; } return [s, t]; }
// √q for a rational q ≥ 0, exactly: sqrtQ(Q(9, 8)) = {s: 3/4, t: 2} (√(9/8) = (3/4)√2)
function sqrtQ(q){ q = Q(q); const [s0, t] = sqrtParts(q.n * q.d); return { s: Q(s0, q.d), t }; }
// Roots of a x² + b x + c = 0 (rational a ≠ 0, b, c): x = p ± s√t, times i when imag.
// kind: "two rational" | "double" | "two irrational" | "complex"
function quadRoots(a, b, c){
  a = Q(a); b = Q(b); c = Q(c); if (a.n === 0) throw new Error("MathRules.quadRoots: a = 0");
  const D = Q.sub(Q.mul(b, b), Q.mul(4, Q.mul(a, c))), p = Q.div(Q.neg(b), Q.mul(2, a));
  const [s0, t] = sqrtParts(Math.abs(D.n) * D.d), s = Q.abs(Q.div(s0, Q.mul(D.d, Q.mul(2, a))));
  const imag = D.n < 0, kind = D.n === 0 ? "double" : imag ? "complex" : t === 1 ? "two rational" : "two irrational";
  const sv = Q.val(s) * Math.sqrt(t), pv = Q.val(p);
  const values = D.n === 0 ? [{ re: pv, im: 0 }] : imag ? [{ re: pv, im: -sv }, { re: pv, im: sv }] : [{ re: pv - sv, im: 0 }, { re: pv + sv, im: 0 }];
  const exact = kind === "two rational" ? [Q.sub(p, s), Q.add(p, s)] : kind === "double" ? [p] : null;
  return { D, kind, p, s: D.n === 0 ? Q(0) : s, t: D.n === 0 ? 1 : t, imag, values, exact };
}

/* Rational functions N(x)/D(x): holes, vertical/horizontal/slant asymptotes, zeros, intercept, domain. */
function rational(num, den){
  num = Poly(num); den = Poly(den);
  const g = Poly.gcd(num, den), n1 = Poly.divmod(num, g).q, d1 = Poly.divmod(den, g).q;
  const holes = Poly.deg(g) >= 1 ? Poly.realRoots(g).filter(r => Math.abs(Poly.evalN(d1, r.x)) > 1e-12).map(r => ({ x: r.x, q: r.q, y: Poly.evalN(n1, r.x) / Poly.evalN(d1, r.x), yq: r.q ? Q.div(Poly.eval(n1, r.q), Poly.eval(d1, r.q)) : null })) : [];
  const vas = Poly.realRoots(d1), zeros = Poly.realRoots(n1).filter(z => !holes.some(h => Math.abs(h.x - z.x) < 1e-12));
  const excluded = Poly.realRoots(den).map(r => ({ x: r.x, q: r.q }));
  const zeroIsOut = excluded.some(e => Math.abs(e.x) < 1e-12);
  const yint = zeroIsOut ? null : Q.div(Poly.eval(n1, 0), Poly.eval(d1, 0));
  const dn = Poly.deg(n1), dd = Poly.deg(d1); let asym;
  if (Poly.isZero(n1)) asym = { type: "horizontal", y: Q(0) };
  else if (dn < dd) asym = { type: "horizontal", y: Q(0) };
  else if (dn === dd) asym = { type: "horizontal", y: Q.div(Poly.lead(n1), Poly.lead(d1)) };
  else asym = { type: dn === dd + 1 ? "slant" : "polynomial", poly: Poly.divmod(n1, d1).q };
  // behaviour beside each vertical asymptote: sign of f just left/right
  const f = x => Poly.evalN(n1, x) / Poly.evalN(d1, x);
  vas.forEach(v => { const e = 1e-6 * Math.max(1, Math.abs(v.x)); v.left = Math.sign(f(v.x - e)); v.right = Math.sign(f(v.x + e)); });
  return { num, den, reduced: { num: n1, den: d1 }, common: g, holes, vas, zeros, excluded, yint, asym, f: x => (excluded.some(e => Math.abs(e.x - x) < 1e-12) ? NaN : f(x)) };
}

/* Transformations g(x) = a·f(b(x − h)) + k */
const transform = (f, t = {}) => { const { a = 1, b = 1, h = 0, k = 0 } = t; return x => a * f(b * (x - h)) + k; };
const transformPoint = ([x, y], t = {}) => { const { a = 1, b = 1, h = 0, k = 0 } = t; return [x / b + h, a * y + k]; };
const compose = (f, g) => x => f(g(x));
// Numeric inverse of a monotone f on [lo, hi]: returns x with f(x) = y, or NaN if y is outside f's range there.
function invert(f, y, lo, hi){ let a = lo, b = hi, fa = f(a) - y, fb = f(b) - y; if (fa === 0) return a; if (fb === 0) return b; if (fa * fb > 0) return NaN; for (let i = 0; i < 80; i++) { const m = (a + b) / 2, fm = f(m) - y; if (fm === 0) return m; if (fa * fm < 0) { b = m; fb = fm; } else { a = m; fa = fm; } } return (a + b) / 2; }
// One-to-one on [lo, hi] (sampled): no two samples share a value.
function isOneToOne(f, lo, hi, n = 400){ let s = 0; for (let i = 0; i <= n; i++) { const x0 = lo + (hi - lo) * i / n, x1 = lo + (hi - lo) * (i + 1) / n; const d = f(x1) - f(x0); if (i < n && isFinite(d) && Math.abs(d) > 1e-12) { const sg = Math.sign(d); if (s && sg !== s) return false; s = sg; } } return true; }

/* Exponentials and logs */
const logb = (b, x) => Math.log(x) / Math.log(b);
// Exact log when b^q = x for a rational q = m/n with n ≤ 12: logExact(8, 4) = 2/3, logExact(2, 1/8) = −3; else null.
function logExact(b, x){ b = Q(b); x = Q(x); if (b.n <= 0 || x.n <= 0 || Q.eq(b, 1)) return null; for (let n = 1; n <= 12; n++) { const m = Math.round(n * logb(Q.val(b), Q.val(x))); if (Math.abs(m) > 60) continue; try { if (Q.eq(Q.pow(b, m), Q.pow(x, n))) return Q(m, n); } catch (e) {} } return null; }
// Compound interest / continuous growth
const compound = (P, r, n, t) => P * Math.pow(1 + r / n, n * t), continuous = (P, r, t) => P * Math.exp(r * t);

/* Sequences and series (exact when given rationals) */
const arith = (a1, d) => ({ term: n => Q.add(a1, Q.mul(n - 1, d)), sum: n => Q.mul(Q(n, 2), Q.add(Q.mul(2, a1), Q.mul(n - 1, d))) });
const geom = (a1, r) => ({ term: n => Q.mul(a1, Q.pow(r, n - 1)), sum: n => (Q.eq(r, 1) ? Q.mul(a1, n) : Q.div(Q.mul(a1, Q.sub(1, Q.pow(r, n))), Q.sub(1, r))), sumInf: () => (Q.lt(Q.abs(r), 1) ? Q.div(a1, Q.sub(1, r)) : null) });
const sigma = (f, lo, hi) => { let s = Q(0); for (let i = lo; i <= hi; i++) s = Q.add(s, f(i)); return s; };

/* Binomial theorem */
function nCr(n, r){ if (r < 0 || r > n) return 0; r = Math.min(r, n - r); let v = 1; for (let i = 1; i <= r; i++) v = v * (n - r + i) / i; return Math.round(v); }
const pascalRow = n => Array.from({ length: n + 1 }, (_, r) => nCr(n, r));
// (a·x + b)^n as a polynomial (lowest degree first); term k of (A + B)^n is C(n,k) A^(n−k) B^k.
const binomialPoly = (a, b, n) => Poly.pow(Poly([b, a]), n);
const binomialTerm = (A, B, n, k) => Q.mul(nCr(n, k), Q.mul(Q.pow(A, n - k), Q.pow(B, k)));

/* Conic sections from A x² + C y² + D x + E y + F = 0 (no xy term). Exact centre/vertex and squared lengths. */
function conic({ A = 0, C = 0, D = 0, E = 0, F = 0 }){
  A = Q(A); C = Q(C); D = Q(D); E = Q(E); F = Q(F);
  const z = Q.zero, out = { A, C, D, E, F };
  if (z(A) && z(C)) return Object.assign(out, { type: "line" });
  if (z(A) || z(C)) {               // parabola
    const vertical = z(C);          // x² term → opens up/down
    const [Sq, Lin, Oth] = vertical ? [A, D, E] : [C, E, D];
    if (z(Oth)) return Object.assign(out, { type: "degenerate" });
    const h = Q.div(Q.neg(Lin), Q.mul(2, Sq)), k = Q.div(Q.sub(Q.div(Q.mul(Lin, Lin), Q.mul(4, Sq)), F), Oth);
    const p = Q.div(Q.neg(Oth), Q.mul(4, Sq));   // (x − h)² = 4p(y − k)  or  (y − k)² = 4p(x − h)
    const [vx, vy] = vertical ? [h, k] : [k, h], pv = Q.val(p);
    return Object.assign(out, { type: "parabola", axis: vertical ? "vertical" : "horizontal", h: vertical ? h : k, k: vertical ? k : h, p, e: 1,
      vertex: [Q.val(vx), Q.val(vy)], focus: vertical ? [Q.val(vx), Q.val(vy) + pv] : [Q.val(vx) + pv, Q.val(vy)], directrix: vertical ? { y: Q.val(vy) - pv } : { x: Q.val(vx) - pv } });
  }
  const h = Q.div(Q.neg(D), Q.mul(2, A)), k = Q.div(Q.neg(E), Q.mul(2, C));
  const R = Q.sub(Q.add(Q.mul(A, Q.mul(h, h)), Q.mul(C, Q.mul(k, k))), F);
  Object.assign(out, { h, k, center: [Q.val(h), Q.val(k)] });
  if (z(R)) return Object.assign(out, { type: "degenerate" });
  const X2 = Q.div(R, A), Y2 = Q.div(R, C);   // (x−h)²/X2 + (y−k)²/Y2 = 1
  Object.assign(out, { X2, Y2 });
  if (Q.val(X2) < 0 && Q.val(Y2) < 0) return Object.assign(out, { type: "empty" });
  const cx = Q.val(h), cy = Q.val(k);
  if (Q.val(X2) > 0 && Q.val(Y2) > 0) {
    if (Q.eq(X2, Y2)) return Object.assign(out, { type: "circle", r2: X2, r: Math.sqrt(Q.val(X2)), e: 0 });
    const horiz = Q.lt(Y2, X2), a2 = horiz ? X2 : Y2, b2 = horiz ? Y2 : X2, c2 = Q.sub(a2, b2), a = Math.sqrt(Q.val(a2)), b = Math.sqrt(Q.val(b2)), c = Math.sqrt(Q.val(c2));
    return Object.assign(out, { type: "ellipse", axis: horiz ? "horizontal" : "vertical", a2, b2, c2, a, b, c, e: c / a,
      vertices: horiz ? [[cx - a, cy], [cx + a, cy]] : [[cx, cy - a], [cx, cy + a]], covertices: horiz ? [[cx, cy - b], [cx, cy + b]] : [[cx - b, cy], [cx + b, cy]],
      foci: horiz ? [[cx - c, cy], [cx + c, cy]] : [[cx, cy - c], [cx, cy + c]] });
  }
  const horiz = Q.val(X2) > 0, a2 = horiz ? X2 : Y2, b2 = Q.neg(horiz ? Y2 : X2), c2 = Q.add(a2, b2), a = Math.sqrt(Q.val(a2)), b = Math.sqrt(Q.val(b2)), c = Math.sqrt(Q.val(c2));
  const m = horiz ? b / a : a / b;
  return Object.assign(out, { type: "hyperbola", axis: horiz ? "horizontal" : "vertical", a2, b2, c2, a, b, c, e: c / a,
    vertices: horiz ? [[cx - a, cy], [cx + a, cy]] : [[cx, cy - a], [cx, cy + a]], foci: horiz ? [[cx - c, cy], [cx + c, cy]] : [[cx, cy - c], [cx, cy + c]],
    asymptotes: [{ m, b: cy - m * cx }, { m: -m, b: cy + m * cx }] });
}
// Standard form → general coefficients. kind "ellipse"/"hyperbola": (x−h)²/X2 ± (y−k)²/Y2 = 1 (sign −1 for a hyperbola,
// with X2 negative for a vertical one handled by passing signX/signY); "parabolaV": (x−h)² = 4p(y−k); "parabolaH": (y−k)² = 4p(x−h).
function conicGeneral(kind, o){
  const h = Q(o.h || 0), k = Q(o.k || 0);
  if (kind === "parabolaV") { const p4 = Q.mul(4, o.p); return { A: Q(1), C: Q(0), D: Q.mul(-2, h), E: Q.neg(p4), F: Q.add(Q.mul(h, h), Q.mul(p4, k)) }; }
  if (kind === "parabolaH") { const p4 = Q.mul(4, o.p); return { A: Q(0), C: Q(1), D: Q.neg(p4), E: Q.mul(-2, k), F: Q.add(Q.mul(k, k), Q.mul(p4, h)) }; }
  // (x−h)²/X2 + (y−k)²/Y2 = 1, X2 or Y2 may be negative (hyperbola); multiply through by X2·Y2
  const X2 = Q(o.X2), Y2 = Q(o.Y2), A = Y2, C = X2;
  return { A, C, D: Q.mul(-2, Q.mul(A, h)), E: Q.mul(-2, Q.mul(C, k)), F: Q.sub(Q.add(Q.mul(A, Q.mul(h, h)), Q.mul(C, Q.mul(k, k))), Q.mul(X2, Y2)) };
}

/* Numeric zeros and intersections of y = f(x) on [lo, hi] (sign changes + touching minima of |f|). */
function zeros(f, lo, hi, n = 600){
  const out = [], xs = [], ys = [];
  for (let i = 0; i <= n; i++) { const x = lo + (hi - lo) * i / n; xs.push(x); ys.push(f(x)); }
  const add = x => { if (!out.some(o => Math.abs(o - x) < (hi - lo) * 1e-6)) out.push(x); };
  for (let i = 0; i < n; i++) {
    const a = ys[i], b = ys[i + 1]; if (!isFinite(a) || !isFinite(b)) continue;
    if (a === 0) add(xs[i]);
    else if (a * b < 0 && Math.abs(a - b) < 1e6) { let L = xs[i], R = xs[i + 1], fl = a; for (let k = 0; k < 70; k++) { const m = (L + R) / 2, fm = f(m); if (fl * fm <= 0) R = m; else { L = m; fl = fm; } } const x = (L + R) / 2; if (Math.abs(f(x)) < 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))) add(x); }
    else if (i > 0 && isFinite(ys[i - 1]) && Math.abs(a) < Math.abs(ys[i - 1]) && Math.abs(a) <= Math.abs(b) && Math.sign(ys[i - 1]) === Math.sign(a) && Math.sign(b) === Math.sign(a)) {
      let L = xs[i - 1], R = xs[i + 1]; const g = x => Math.abs(f(x)); for (let k = 0; k < 80; k++) { const m1 = L + (R - L) / 3, m2 = R - (R - L) / 3; if (g(m1) < g(m2)) R = m2; else L = m1; } const x = (L + R) / 2; if (g(x) < 1e-9) add(x);
    }
  }
  if (ys[n] === 0) add(xs[n]);
  return out.sort((a, b) => a - b);
}
const intersect = (f, g, lo, hi, n) => zeros(x => f(x) - g(x), lo, hi, n).map(x => ({ x, y: f(x) }));

/* Ticks and collision-free label placement live in the categorical plane kit (PlaneRules); aliased here. */
const PR = W.PlaneRules || {};
const niceStep = PR.niceStep, ticks = PR.ticks, placeLabels = PR.placeLabels;

/* Formatters: HTML for the readout and dossier-like markup, plain text for canvas. Minus is always U+2212. */
const sg = n => (n < 0 ? MI + Math.abs(n) : String(n));
const fmtN = (v, d = 3) => { if (!isFinite(v)) return "undefined"; const s = String(Math.round(v * 10 ** d) / 10 ** d); return (s === "-0" ? "0" : s).replace("-", MI); };
const qT = q => { q = Q(q); return (q.n < 0 ? MI : "") + Math.abs(q.n) + (q.d === 1 ? "" : "/" + q.d); };
const qH = (q, cls = "") => { q = Q(q); const m = q.d === 1 ? String(Math.abs(q.n)) : `<span class="fr"><span>${Math.abs(q.n)}</span><span>${q.d}</span></span>`; return `<span class="m${cls ? " " + cls : ""}">${q.n < 0 ? MI : ""}${m}</span>`; };
const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
const supT = e => String(e).split("").map(c => SUP[c] || c).join("");
// Polynomial as text ("2x³ − x + 5") or HTML ("2<i>x</i><sup>3</sup> − …"). opts: v (variable), html, frac (HTML fractions)
function polyStr(p, o = {}){
  p = Poly(p); const html = !!o.html, v = o.v || (html ? "<i>x</i>" : "x"); let s = "";
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i]; if (c.n === 0) continue;
    const a = Q.abs(c), one = a.n === 1 && a.d === 1 && i > 0;
    const mag = one ? "" : html && a.d !== 1 && o.frac !== false ? `<span class="fr"><span>${a.n}</span><span>${a.d}</span></span>` : qT(a);
    const pw = i === 0 ? "" : i === 1 ? v : html ? `${v}<sup>${i}</sup>` : v + supT(i);
    s += s ? (c.n < 0 ? " − " : " + ") : c.n < 0 ? MI : ""; s += mag + pw;
  }
  return s || "0";
}
const polyT = (p, v) => polyStr(p, { v }), polyH = (p, v) => polyStr(p, { html: true, v });
// Complex a + bi: "3 − 4i" (text) / HTML with italic i
function zStr(z, html){ z = Z(z); const i = html ? "<i>i</i>" : "i", re = z.re, im = z.im, F = html ? q => qH(q) : qT;
  if (im.n === 0) return F(re);
  const ai = Q.abs(im), mag = ai.n === 1 && ai.d === 1 ? "" : html ? qH(ai) : qT(ai);
  if (re.n === 0) return (im.n < 0 ? MI : "") + mag + i;
  return F(re) + (im.n < 0 ? " − " : " + ") + mag + i; }
const zT = z => zStr(z, false), zH = z => zStr(z, true);
// a·√t, in text or HTML (overline radicand). sqrtStr(Q(3,2), 5) = "3/2√5"
const radStr = (s, t, html) => { s = Q(s); if (t === 1) return html ? qH(s) : qT(s); const r = html ? `√<span class="mk-ol">${t}</span>` : `√${t}`; return (Q.eq(Q.abs(s), 1) ? (s.n < 0 ? MI : "") : html ? qH(s) : qT(s)) + r; };
// Quadratic roots as text/HTML: "−1 ± 2√3", "2 ± i", "−3/2" …
function rootsStr(R, html){
  const F = html ? q => qH(q) : qT, i = html ? "<i>i</i>" : "i";
  if (R.kind === "double") return F(R.p);
  if (R.kind === "two rational") return R.exact.map(F).join(", ");
  const part = (Q.eq(R.s, 1) && R.t === 1 ? "" : radStr(R.s, R.t, html)) + (R.imag ? i : "");
  return (R.p.n === 0 ? "±" : F(R.p) + " ± ") + (part || "1");
}
// Linear factor for a zero r: factorStr(3) = "x − 3", factorStr(Q(-1, 2)) = "x + 1/2", {integer: true} → "2x + 1"; {html} italic x.
function factorStr(r, o = {}){ r = Q(r); const v = o.html ? "<i>x</i>" : (o.v || "x");
  if (r.n === 0) return v;
  if (o.integer && r.d !== 1) return `${r.d}${v} ${r.n < 0 ? "+" : "−"} ${Math.abs(r.n)}`;
  return `${v} ${r.n < 0 ? "+" : "−"} ${o.html ? qH(Q.abs(r)) : qT(Q.abs(r))}`; }
// Reveal guard for step-by-step work: entries after index k become null (render as placeholders), so nothing
// ahead of the stepper is ever in the DOM.
const reveal = (W.LabKit && W.LabKit.reveal) || ((lines, k) => lines.map((l, i) => (i <= k ? l : null)));

/* ---------------- Algebra II → Precalculus rules (moved from the a2-b* labs; tested in tests/math.test.js) ---------------- */
// f and g are defined at the same sample points of [lo, hi] and agree there (at least one point defined).
function sameGraph(f, g, lo, hi, n = 241){
  let any = false;
  for (let i = 0; i < n; i++) {
    const x = lo + (hi - lo) * (i + 0.37) / n, u = f(x), v = g(x), fu = isFinite(u), fv = isFinite(v);
    if (fu !== fv) return false;
    if (fu) { any = true; if (Math.abs(u - v) > 1e-7 * (1 + Math.abs(u))) return false; }
  }
  return any;
}
// Exact real sets RS: sorted unions of intervals {lo, hi, lc, hc}; an endpoint is {v, t (text), h (html)}, null = ±∞.
// RS.ep(q) endpoint, RS.root(s, ±1) endpoint ±√s, RS.ALL(), RS.ge(e, strict) [e, ∞), RS.ne(...es) ℝ minus points,
// RS.and(A, B) intersection, RS.or(A, B) union, RS.has(A, x), RS.str(A, html) "(−∞, 2] ∪ {5}" / "∅".
const RS = (() => {
  const qh = q => (q.d === 1 ? sg(q.n) : `${q.n < 0 ? MI : ""}<span class="fr"><span>${Math.abs(q.n)}</span><span>${q.d}</span></span>`);
  const ep = q => { q = Q(q); return { v: q.n / q.d, t: qT(q), h: qh(q) }; };
  const root = (s, sign) => { const [m, r] = sqrtParts(s); if (r === 1) return ep(sign * m); const pre = (sign < 0 ? MI : "") + (m > 1 ? m : "");
    return { v: sign * Math.sqrt(s), t: `${pre}√${r}`, h: `${pre}√<span class="mk-ol">${r}</span>` }; };
  const ALL = () => [{ lo: null, hi: null }];
  const ge = (e, strict) => [{ lo: e, hi: null, lc: !strict }];
  const ne = (...es) => { es.sort((a, b) => a.v - b.v); const out = []; let lo = null; es.forEach(e => { out.push({ lo, hi: e, lc: false, hc: false }); lo = e; }); out.push({ lo, hi: null, lc: false }); return out; };
  const E = 1e-12;
  function and(A, B){
    const out = [];
    for (const a of A) for (const b of B) {
      let lo = a.lo, lc = a.lc, hi = a.hi, hc = a.hc;
      if (b.lo && (!lo || b.lo.v > lo.v + E)) { lo = b.lo; lc = b.lc; } else if (b.lo && lo && Math.abs(b.lo.v - lo.v) <= E) lc = lc && b.lc;
      if (b.hi && (!hi || b.hi.v < hi.v - E)) { hi = b.hi; hc = b.hc; } else if (b.hi && hi && Math.abs(b.hi.v - hi.v) <= E) hc = hc && b.hc;
      if (lo && hi && (lo.v > hi.v + E || (Math.abs(lo.v - hi.v) <= E && !(lc && hc)))) continue;
      out.push({ lo, hi, lc, hc });
    }
    return out;
  }
  // union: pieces sorted by left end, overlapping ones merged, touching ones merged when the shared end is in either piece
  function or(A, B){
    const lv = p => (p.lo ? p.lo.v : -Infinity), hv = p => (p.hi ? p.hi.v : Infinity);
    const ps = A.concat(B).filter(p => !(p.lo && p.hi && (p.lo.v > p.hi.v + E || (Math.abs(p.lo.v - p.hi.v) <= E && !(p.lc && p.hc)))))
      .map(p => ({ lo: p.lo, hi: p.hi, lc: !!p.lc && !!p.lo, hc: !!p.hc && !!p.hi }))
      .sort((a, b) => lv(a) - lv(b) || (b.lc - a.lc));
    const out = [];
    for (const p of ps) {
      const c = out[out.length - 1];
      if (c && (hv(c) > lv(p) + E || (Math.abs(hv(c) - lv(p)) <= E && (c.hc || p.lc || (!c.hi && !p.lo))))) {
        if (Math.abs(lv(c) - lv(p)) <= E) c.lc = c.lc || p.lc;
        if (hv(p) > hv(c) + E) { c.hi = p.hi; c.hc = p.hc; } else if (Math.abs(hv(p) - hv(c)) <= E) c.hc = c.hc || p.hc;
      } else out.push(p);
    }
    return out.map(p => (p.lo || p.hi ? p : { lo: null, hi: null }));
  }
  const has = (A, x) => A.some(p => (!p.lo || x > p.lo.v + 1e-9 || (p.lc && Math.abs(x - p.lo.v) <= 1e-9)) && (!p.hi || x < p.hi.v - 1e-9 || (p.hc && Math.abs(x - p.hi.v) <= 1e-9)));
  const str = (A, html) => { const e = p => (html ? p.h : p.t); if (!A.length) return "∅";
    return A.map(p => (p.lo && p.hi && Math.abs(p.lo.v - p.hi.v) <= E ? `{${e(p.lo)}}` : (p.lo ? (p.lc ? "[" : "(") + e(p.lo) : "(" + MI + "∞") + ", " + (p.hi ? e(p.hi) + (p.hc ? "]" : ")") : "∞)"))).join(" ∪ "); };
  return { ep, root, ALL, ge, ne, and, or, has, str, qh };
})();

/* rational roots: the order to test candidates, synthetic-division distractors, a full factoring plan */
// Candidate test order a person would use: integers by size (positive first), then fractions by size.
const rootTestOrder = cands => cands.slice().sort((a, b) => (a.d !== 1) - (b.d !== 1) || Math.abs(Q.val(a)) - Math.abs(Q.val(b)) || Q.val(b) - Q.val(a));
// Wrong remainders a student typically gets dividing p by (x − r), each {v, why}; at most 3 (multiple-choice checks).
function synthDistractors(p, r){
  r = Q(r); const S = Poly.synth(p, r), right = S.rem, top = S.top, n = top.length - 1, out = [];
  const add = (v, why) => { if (!Q.eq(v, right) && !out.some(o => Q.eq(o.v, v))) out.push({ v, why }); };
  add(Poly.eval(p, Q.neg(r)), `That is P(${qT(Q.neg(r))}): the sign of r was taken from the divisor as written. For x ${r.n < 0 ? "+" : MI} ${qT(Q.abs(r))}, r = ${qT(r)}.`);
  const nz = top.filter(c => c.n !== 0);
  if (nz.length < top.length) { const T = Poly.synth(Poly(nz.slice().reverse()), r); add(T.rem, "The zero placeholders were left out, so the columns slid together."); }
  if (n >= 1) add(Q.add(top[n], S.bottom[n - 1]), "The last column was added without multiplying by r first.");
  if (n >= 1) add(Q.mul(S.bottom[n - 1], r), "The last product was not added to the constant term.");
  add(Q.add(right, r), "Check the last addition: the carried number plus the constant term.");
  add(Q.neg(right), "Right size, wrong sign: recheck the signs in the last column.");
  return out.slice(0, 3);
}
// Deflation plan for an integer polynomial: candidates tested in rootTestOrder, each zero found with its synthetic row,
// then the last quadratic (or linear) factor. P = K · Π(qx − p) · rest; factorsT is that product as text.
function factorPlan(P){
  const linT = r => factorStr(r, { integer: true });
  const cands = Poly.ratCandidates(P), order = rootTestOrder(cands), stages = []; let cur = P, idx = 0, fails = [];
  while (Poly.deg(cur) > 2 && idx < order.length) {
    const c = order[idx], v = Poly.eval(cur, c);
    if (v.n === 0) { const S = Poly.synth(cur, c); stages.push({ poly: cur, fails, root: c, synth: S, q: S.q }); cur = S.q; fails = []; }
    else { fails.push({ c, v }); idx++; }
  }
  const roots = stages.map(s => s.root); let quad = null;
  if (Poly.deg(cur) === 1) { roots.push(Q.div(Q.neg(cur[0]), cur[1])); }
  else if (Poly.deg(cur) === 2) {
    const R = quadRoots(cur[2], cur[1], cur[0]);
    const rr = Poly.ratRoots(cur).roots; const rat = rr.reduce((m, o) => m + o.m, 0) === 2;
    quad = { poly: cur, R, rat, roots: rat ? rr.flatMap(o => Array(o.m).fill(o.r)) : [] };
    if (rat) roots.push(...quad.roots);
  }
  const lin = roots.map(r => Q(r));
  const restP = quad && !quad.rat ? Poly.primitive(cur).map(v => Q(v)) : null;
  let K = Poly.lead(P); lin.forEach(r => { K = Q.div(K, r.d); }); if (restP) K = Q.div(K, Poly.lead(restP));
  const groups = []; lin.forEach(r => { const g = groups.find(o => Q.eq(o.r, r)); if (g) g.m++; else groups.push({ r, m: 1 }); });
  const factorsT = (K.n === 1 && K.d === 1 ? "" : K.n === -1 && K.d === 1 ? MI : qT(K)) + groups.map(g => `(${linT(g.r)})${g.m > 1 ? supT(g.m) : ""}`).join("") + (restP ? `(${polyT(restP)})` : "");
  return { cands, order, stages, quad, rest: cur, restP, groups, K, factorsT };
}

/* polynomial graphs: factored form, multiplicity, turning points, symmetry, signs, end behaviour */
// Leading coefficient as a prefix: 1 → "", −1 → "−", 1/2 → "1/2"
const leadStr = a => { a = Q(a); return a.n === a.d ? "" : a.n === -a.d ? MI : qT(a); };
const zeroFactorT = (r, html) => { r = Q(r); const v = html ? "<i>x</i>" : "x"; return r.n === 0 ? v : `${v} ${r.n > 0 ? MI : "+"} ${qT(Q.abs(r))}`; };
// a·Π(x − r)^m from [{r, m}] (zero first, then by value): "−2x(x + 1)²(x − 3)" (text) or HTML with <sup>
function factoredStr(a, groups, html){
  const pw = m => (m > 1 ? (html ? `<sup>${m}</sup>` : supT(m)) : "");
  const gs = groups.slice().sort((u, v) => (Q(u.r).n !== 0) - (Q(v.r).n !== 0) || Q.val(u.r) - Q.val(v.r));
  const body = gs.map(g => (Q(g.r).n === 0 ? (html ? "<i>x</i>" : "x") + pw(g.m) : `(${zeroFactorT(g.r, html)})${pw(g.m)}`)).join("");
  return (leadStr(a) + body) || qT(a);
}
// Group equal zeros: [r, r, s] → [{r, m: 2}, {r: s, m: 1}]
const groupZeros = rs => { const out = []; rs.forEach(r => { const g = out.find(o => Q.eq(o.r, r)); if (g) g.m++; else out.push({ r: Q(r), m: 1 }); }); return out; };
// Turning points: real zeros of p′ of odd multiplicity (p′ changes sign there). [{x, q, m}]
const turningPoints = p => (Poly.deg(p) < 2 ? [] : Poly.realRoots(Poly.deriv(p)).filter(o => o.m % 2 === 1));
// Symmetry from the powers present: "even" (only even powers), "odd" (only odd powers) or "neither"
const polySymmetry = p => { const nz = p.map((c, i) => (c.n !== 0 ? i : -1)).filter(i => i >= 0); return nz.every(i => i % 2 === 0) ? "even" : nz.every(i => i % 2 === 1) ? "odd" : "neither"; };
// Sign of p on each interval between its distinct real zeros xs (sorted): ["+", "−", …]
const signPattern = (p, xs) => { const f = Poly.fn(p), pts = xs.length ? [xs[0] - 1, ...xs.slice(1).map((x, i) => (xs[i] + x) / 2), xs[xs.length - 1] + 1] : [0]; return pts.map(t => (f(t) > 0 ? "+" : MI)); };
// End behaviour as text: "x → −∞, f(x) → ∞; x → ∞, f(x) → −∞"
const endsStr = (p, html) => { const e = Poly.ends(p), v = html ? "<i>x</i>" : "x", f = html ? "<i>f</i>(<i>x</i>)" : "f(x)", s = t => (t > 0 ? "∞" : MI + "∞"); return `${v} → ${MI}∞, ${f} → ${s(e.left)}; ${v} → ∞, ${f} → ${s(e.right)}`; };

/* rational functions: sign chart, crossing the asymptote; variation */
// Sign of R = rational(num, den) on each interval between its critical values (real zeros of the reduced numerator and
// reduced denominator): [{lo, hi, t, s}], lo/hi = null for ∓∞, t = test value, s = ±1.
function signIntervals(R){
  const n1 = R.reduced.num, d1 = R.reduced.den;
  const cr = [...R.zeros.map(z => z.x), ...R.vas.map(v => v.x)].sort((a, b) => a - b).filter((v, i, a) => !i || Math.abs(v - a[i - 1]) > 1e-9);
  const ends = [null, ...cr, null], out = [];
  for (let i = 0; i < ends.length - 1; i++) {
    const lo = ends[i], hi = ends[i + 1], t = lo === null && hi === null ? 0 : lo === null ? hi - 1 : hi === null ? lo + 1 : (lo + hi) / 2;
    out.push({ lo, hi, t, s: Math.sign(Poly.evalN(n1, t) / Poly.evalN(d1, t)) });
  }
  return out;
}
// Where R = rational(…) meets its horizontal or slant asymptote: real zeros, inside the domain, of the remainder of
// reduced numerator ÷ reduced denominator. [] when there is no such asymptote or no crossing.
function asymCross(R){
  if (R.asym.type !== "horizontal" && R.asym.type !== "slant") return [];
  const r = Poly.divmod(R.reduced.num, R.reduced.den).r;
  if (Poly.isZero(r)) return [];
  return Poly.realRoots(r).filter(z => !R.excluded.some(e => Math.abs(e.x - z.x) < 1e-9));
}
// Exact constant of variation through (x0, y0) for y = kxⁿ or y = k/xⁿ: {k, y (exact), f (numeric), dbl (factor when x doubles)}.
// type: "direct" | "inverse" | "square" | "invsq".
const VARIATION = { direct: { n: 1, inv: false }, inverse: { n: 1, inv: true }, square: { n: 2, inv: false }, invsq: { n: 2, inv: true } };
function variation(type, x0, y0){
  const T = VARIATION[type], xn = Q.pow(Q(x0), T.n);
  const kq = T.inv ? Q.mul(Q(y0), xn) : Q.div(Q(y0), xn);
  const y = x => (T.inv ? Q.div(kq, Q.pow(Q(x), T.n)) : Q.mul(kq, Q.pow(Q(x), T.n)));
  return { k: kq, y, f: x => (T.inv ? Q.val(kq) / Math.pow(x, T.n) : Q.val(kq) * Math.pow(x, T.n)), dbl: T.inv ? Q(1, 2 ** T.n) : Q(2 ** T.n) };
}

/* polynomial and rational inequalities by a sign chart */
// Inequality symbols: s = sign wanted, eq = boundary zeros included; INEQ_FLIP reverses the direction
const INEQ = { ">": { s: 1, eq: false }, "≥": { s: 1, eq: true }, "<": { s: -1, eq: false }, "≤": { s: -1, eq: true } };
const INEQ_FLIP = { ">": "<", "<": ">", "≥": "≤", "≤": "≥" };
// Critical values of N/D, sorted: [{x, q, m, out}]; out = true where D = 0 (excluded, even if N = 0 there too)
function criticalValues(N, D){
  const out = (Poly.deg(D) >= 1 ? Poly.realRoots(D) : []).map(p => ({ x: p.x, q: p.q, m: p.m, out: true }));
  Poly.realRoots(N).forEach(z => { if (!out.some(o => Math.abs(o.x - z.x) < 1e-9)) out.push({ x: z.x, q: z.q, m: z.m, out: false }); });
  return out.sort((a, b) => a.x - b.x);
}
// A friendly test value (Q) strictly inside (lo, hi) (critical values, null = unbounded): 0 if possible, else the integer
// nearest the middle, else the midpoint
function testValue(lo, hi){
  if (!lo && !hi) return Q(0);
  if (!lo) return Q(Math.ceil(hi.x) - 1);
  if (!hi) return Q(Math.floor(lo.x) + 1);
  const a = Math.floor(lo.x) + 1, b = Math.ceil(hi.x) - 1, mid = (lo.x + hi.x) / 2;
  if (a <= b) return Q(a <= 0 && b >= 0 ? 0 : Math.min(b, Math.max(a, Math.round(mid))));
  return lo.q && hi.q ? Q.div(Q.add(lo.q, hi.q), Q(2)) : Q(Math.round(mid * 1000) / 1000);
}
// Solve N(x)/D(x) rel 0 (rel one of > ≥ < ≤) by a sign chart.
// → {N, D, rel, crit (each with inSet), ivs: [{lo, hi, t, v, s, inSet}], pieces: [{pt} | {lo, loIn, hi, hiIn}] (lo/hi = crit or null)}
function solveIneq(N, D, rel){
  N = Poly(N); D = Poly(D || [1]);
  const R = INEQ[rel], crit = criticalValues(N, D), ivs = [];
  for (let i = 0; i <= crit.length; i++) {
    const lo = crit[i - 1] || null, hi = crit[i] || null, t = testValue(lo, hi), v = Q.div(Poly.eval(N, t), Poly.eval(D, t)), s = Math.sign(v.n);
    ivs.push({ lo, hi, t, v, s, inSet: s === R.s });
  }
  crit.forEach(c => { c.inSet = !c.out && R.eq; });
  const items = []; ivs.forEach((iv, i) => { items.push({ iv }); if (crit[i]) items.push({ c: crit[i] }); });
  const runs = []; let run = null;
  items.forEach(it => { if (it.iv ? it.iv.inSet : it.c.inSet) { run = run || { first: it }; run.last = it; } else if (run) { runs.push(run); run = null; } });
  if (run) runs.push(run);
  const pieces = runs.map(r => (r.first === r.last && r.first.c ? { pt: r.first.c }
    : { lo: r.first.iv ? r.first.iv.lo : r.first.c, loIn: !!r.first.c, hi: r.last.iv ? r.last.iv.hi : r.last.c, hiIn: !!r.last.c }));
  return { N, D, rel, crit, ivs, pieces };
}
const critT = c => (c.q ? qT(c.q) : fmtN(c.x, 3));
// Solution set of solveIneq in interval notation (text): "(−∞, −2] ∪ {1} ∪ [3, ∞)", "∅"
const ineqSetStr = S => (!S.pieces.length ? "∅" : S.pieces.map(p => (p.pt ? `{${critT(p.pt)}}`
  : `${p.lo && p.loIn ? "[" : "("}${p.lo ? critT(p.lo) : MI + "∞"}, ${p.hi ? critT(p.hi) : "∞"}${p.hi && p.hiIn ? "]" : ")"}`)).join(" ∪ "));
// Polynomial in factored form with integer linear factors: 2x² + 5x − 3 → "(2x − 1)(x + 3)", −x + 5 → "−(x − 5)"
function factorIntStr(p, html){
  p = Poly(p); const { roots, rest } = Poly.ratRoots(p); let den = Q(1);
  const sup = m => (m > 1 ? (html ? `<sup>${m}</sup>` : supT(m)) : "");
  const fs = roots.map(({ r, m }) => { den = Q.mul(den, Q.pow(Q(r.d), m)); const s = factorStr(r, { integer: true, html }); return r.n === 0 ? s + sup(m) : `(${s})${sup(m)}`; });
  fs.sort((a, b) => (b[0] !== "(") - (a[0] !== "("));
  const restS = Poly.scale(rest, Q.inv(den));
  if (Poly.deg(restS) >= 1) { const ld = Poly.lead(restS), mon = Poly.scale(restS, Q.inv(ld)), pre = Q.eq(ld, 1) ? "" : Q.eq(ld, -1) ? MI : qT(ld);
    return pre + (fs.length || pre ? `(${polyStr(mon, { html })})` : polyStr(mon, { html })) + fs.join(""); }
  const c0 = restS[0], pre = Q.eq(c0, 1) ? "" : Q.eq(c0, -1) ? MI : qT(c0);
  if (!fs.length) return qT(c0);
  if (fs.length === 1 && !pre && fs[0][0] === "(" && roots[0].m === 1) return fs[0].slice(1, -1);
  return pre + fs.join("");
}

/* quadratics: vertex form; shifted terms */
// Vertex form of ax² + bx + c (a ≠ 0), exactly: {a, b, c, m, q, h, k} with m = b/(2a), q = m² (the completing term), h = −m, k = c − a·q.
function vertexForm(a, b, c){
  a = Q(a); b = Q(b); c = Q(c);
  const m = Q.div(b, Q.mul(2, a)), q = Q.mul(m, m);
  return { a, b, c, m, q, h: Q.neg(m), k: Q.sub(c, Q.mul(a, q)) };
}
// a(x − h)² + k as text or HTML (o.html: italic x, <sup>, fractions; h wrapped in class c1, k in c2, a in c3)
function vertexFormStr(a, h, k, o = {}){
  const html = !!o.html, X = html ? "<i>x</i>" : "x", sq = html ? "<sup>2</sup>" : "²";
  const num = q => (html ? qH(q) : qT(q)), wrap = (s, cls) => (html && cls ? `<span class="${cls}">${s}</span>` : s);
  const co = Q.eq(a, 1) ? "" : Q.eq(a, -1) ? MI : html || Q.isInt(a) ? num(a) : `${Q.val(a) < 0 ? MI : ""}(${qT(Q.abs(a))})`;
  const sqr = Q.zero(h) ? X + sq : `(${X} ${Q.val(h) > 0 ? MI : "+"} ${wrap(num(Q.abs(h)), "c1")})${sq}`;
  const kk = Q.zero(k) ? "" : ` ${Q.val(k) > 0 ? "+" : MI} ${wrap(num(Q.abs(k)), "c2")}`;
  return wrap(co, "c3") + sqr + kk;
}
// "(v − h)" or "v" (h = 0), text or HTML (italic v): shiftStr("y", −2) = "(y + 2)"
const shiftStr = (v, h, html) => { const V = html ? `<i>${v}</i>` : v; h = Q(h); return Q.zero(h) ? V : `(${V} ${Q.val(h) > 0 ? MI : "+"} ${qT(Q.abs(h))})`; };
// "(v − h)²" or "v²": sqShiftStr("x", 2) = "(x − 2)²"
const sqShiftStr = (v, h, html) => { h = Q(h); const V = html ? `<i>${v}</i>` : v, sq = html ? "<sup>2</sup>" : "²";
  if (h.n === 0) return V + sq; return `(${V} ${h.n > 0 ? MI : "+"} ${qT(Q.abs(h))})${sq}`; };

/* conics: standard-form text, ± values, general form; intersections of conics and lines */
// √q (rational q ≥ 0) as simplified text/HTML: sqrtQStr(25/4) = "5/2", sqrtQStr(8) = "2√2"
const sqrtQStr = (q, html) => { const r = sqrtQ(q); return radStr(r.s, r.t, html); };
// Standard form of a conic result {type, h, k, X2, Y2, r2, p, axis} (as from conic()) as text or HTML; "" for other types.
function conicStdForm(r, html){
  const over = (t, q) => (Q.eq(q, 1) ? t : html ? `<span class="fr"><span>${t}</span><span>${qT(q)}</span></span>` : `${t}/${qT(q)}`);
  const X = sqShiftStr("x", r.h, html), Y = sqShiftStr("y", r.k, html);
  if (r.type === "circle") return `${X} + ${Y} = ${qT(r.r2)}`;
  if (r.type === "ellipse") return `${over(X, r.X2)} + ${over(Y, r.Y2)} = 1`;
  if (r.type === "hyperbola") return Q.val(r.X2) > 0 ? `${over(X, r.X2)} ${MI} ${over(Y, Q.neg(r.Y2))} = 1` : `${over(Y, r.Y2)} ${MI} ${over(X, Q.neg(r.X2))} = 1`;
  if (r.type === "parabola") { const p4 = Q.mul(4, r.p), co = Q.eq(p4, 1) ? "" : Q.eq(p4, -1) ? MI : qT(p4);
    return r.axis === "vertical" ? `${X} = ${co}${shiftStr("y", r.k, html)}` : `${Y} = ${co}${shiftStr("x", r.h, html)}`; }
  return "";
}
const ptQT = (x, y) => `(${qT(x)}, ${qT(y)})`;
// "h ± √q" exactly (text/HTML); "±√q" when h = 0
const pmRootStr = (h, q, html) => { const c = sqrtQStr(q, html); return Q(h).n === 0 ? `±${c}` : `${qT(h)} ± ${c}`; };
// The two points (h ± √q, k) (or (h, k ± √q) when !horiz): an exact pair when √q is rational and the centre coordinate
// is not 0, else the compact ± form.  pmPairStr(2, −1, 25, true) = "(−3, −1), (7, −1)"
function pmPairStr(h, k, q, horiz, html){ const r = sqrtQ(q), m = horiz ? Q(h) : Q(k);
  if (r.t === 1 && m.n !== 0) { const c = r.s, a = Q.sub(m, c), b = Q.add(m, c); return horiz ? `${ptQT(a, k)}, ${ptQT(b, k)}` : `${ptQT(h, a)}, ${ptQT(h, b)}`; }
  return horiz ? `(${pmRootStr(h, q, html)}, ${qT(k)})` : `(${qT(h)}, ${pmRootStr(k, q, html)})`; }
// General form Ax² + Cy² + Dx + Ey + F = 0 (rational coefficients, {A, C, D, E, F}) as HTML
function generalFormH(o){
  let s = "";
  [[o.A, "<i>x</i><sup>2</sup>"], [o.C, "<i>y</i><sup>2</sup>"], [o.D, "<i>x</i>"], [o.E, "<i>y</i>"], [o.F, ""]].forEach(([c, v]) => {
    c = Q(c || 0); if (Q.zero(c)) return; const m = Q.abs(c), num = Q.eq(m, 1) && v ? "" : qT(m);
    s += s ? (Q.val(c) < 0 ? ` ${MI} ` : " + ") : Q.val(c) < 0 ? MI : ""; s += num + v; });
  return (s || "0") + " = 0";
}
// Intersections of a conic c1 = {A, C, E, F}: A x² + C y² + E y + F = 0 (no x-term, A ≠ 0) with c2 = a line {kind: "line", m, b}
// (y = m x + b) or a second such conic {A, C, E, F}. All coefficients rational.
// → {pts: [{x, y, xt, yt, exact}], kind: "points"|"none"|"infinite", red: {v, a, b, c} the one-variable equation,
//    D (discriminant or null), complex (a negative discriminant), rejected: [{y, X}] (x² < 0), tangent}
function conicSystem(c1, c2){
  const z = Q.zero, out = { pts: [], kind: "points", complex: false, rejected: [], tangent: false, D: null };
  const fmtX = X => { const r = sqrtQ(X); return r.t === 1 ? [r.s, qT(r.s), qT(Q.neg(r.s))] : [null, radStr(r.s, r.t, false), MI + radStr(r.s, r.t, false)]; };
  const push = (x, y, xt, yt, exact) => out.pts.push({ x, y, xt, yt, exact });
  const { A, C, E, F } = c1;
  if (c2.kind === "line") {
    const { m, b } = c2, al = Q.add(A, Q.mul(C, Q.mul(m, m))), be = Q.add(Q.mul(2, Q.mul(C, Q.mul(m, b))), Q.mul(E, m)), ga = Q.add(Q.add(Q.mul(C, Q.mul(b, b)), Q.mul(E, b)), F);
    out.red = { v: "x", a: al, b: be, c: ga };
    const yOf = x => Q.add(Q.mul(m, x), b);
    if (z(al)) { if (z(be)) { out.kind = z(ga) ? "infinite" : "none"; return out; } const x = Q.div(Q.neg(ga), be), y = yOf(x); push(Q.val(x), Q.val(y), qT(x), qT(y), true); return out; }
    const r = quadRoots(al, be, ga); out.D = r.D;
    if (r.kind === "complex") { out.complex = true; out.kind = "none"; return out; }
    if (r.exact) r.exact.forEach(x => { const y = yOf(x); push(Q.val(x), Q.val(y), qT(x), qT(y), true); });
    else r.values.forEach(v => { const y = Q.val(m) * v.re + Q.val(b); push(v.re, y, fmtN(v.re, 2), fmtN(y, 2), false); });
    out.tangent = r.kind === "double";
    return out;
  }
  const A2 = c2.A, C2 = c2.C, E2 = c2.E, F2 = c2.F;
  const al = Q.sub(Q.mul(A2, C), Q.mul(A, C2)), be = Q.sub(Q.mul(A2, E), Q.mul(A, E2)), ga = Q.sub(Q.mul(A2, F), Q.mul(A, F2));
  out.red = { v: "y", a: al, b: be, c: ga };
  if (z(al) && z(be)) { out.kind = z(ga) ? "infinite" : "none"; return out; }
  let ys = [];
  if (z(al)) ys = [{ q: Q.div(Q.neg(ga), be) }];
  else { const r = quadRoots(al, be, ga); out.D = r.D; if (r.kind === "complex") { out.complex = true; out.kind = "none"; return out; }
    out.tangent = r.kind === "double"; ys = r.exact ? r.exact.map(q => ({ q })) : r.values.map(v => ({ v: v.re })); }
  ys.forEach(Y => {
    if (Y.q) { const y = Y.q, X = Q.div(Q.neg(Q.add(Q.add(Q.mul(C, Q.mul(y, y)), Q.mul(E, y)), F)), A), yt = qT(y);
      if (Q.val(X) < 0) { out.rejected.push({ y: yt, X: qT(X) }); return; }
      if (z(X)) { out.tangent = true; push(0, Q.val(y), "0", yt, true); return; }
      const [, p, n] = fmtX(X), xv = Math.sqrt(Q.val(X)); push(-xv, Q.val(y), n, yt, true); push(xv, Q.val(y), p, yt, true); }
    else { const y = Y.v, X = -(Q.val(C) * y * y + Q.val(E) * y + Q.val(F)) / Q.val(A);
      if (X < -1e-12) { out.rejected.push({ y: fmtN(y, 2), X: fmtN(X, 2) }); return; }
      if (X < 1e-12) { out.tangent = true; push(0, y, "0", fmtN(y, 2), false); return; }
      const xv = Math.sqrt(X); push(-xv, y, fmtN(-xv, 2), fmtN(y, 2), false); push(xv, y, fmtN(xv, 2), fmtN(y, 2), false); }
  });
  if (!out.pts.length) out.kind = "none";
  return out;
}

/* linear systems */
// Exact solution of a linear system given as augmented rows [a₁, …, aₙ, d] (n equations in n unknowns, any n), by
// Gauss–Jordan elimination: {kind: "unique", x: [Q]} | {kind: "none"} (inconsistent) | {kind: "infinite"} (dependent), with rank.
function linSolve(rows){
  const n = rows.length, M = rows.map(r => r.map(v => Q(v))), m = M[0].length - 1; let rank = 0;
  for (let col = 0; col < m && rank < n; col++) {
    const piv = M.findIndex((r, i) => i >= rank && r[col].n !== 0); if (piv < 0) continue;
    [M[rank], M[piv]] = [M[piv], M[rank]];
    const pv = M[rank][col]; M[rank] = M[rank].map(v => Q.div(v, pv));
    for (let i = 0; i < n; i++) if (i !== rank && M[i][col].n !== 0) { const f = M[i][col]; M[i] = M[i].map((v, j) => Q.sub(v, Q.mul(f, M[rank][j]))); }
    rank++;
  }
  if (M.some(r => r.slice(0, m).every(v => v.n === 0) && r[m].n !== 0)) return { kind: "none", rank };
  if (rank < m) return { kind: "infinite", rank };
  return { kind: "unique", rank, x: M.slice(0, m).map(r => r[m]) };
}
// One elimination step on integer equations [a, b, c, d] (ax + by + cz = d): p·A + q·B with variable i removed,
// signs chosen so the first remaining coefficient is positive, then divided by the common factor g.
// elimStep([1,1,1,6], [2,−1,1,3], 0) → {p: 2, q: −1, g: 1, r: [0, 3, 1, 9]}
function elimStep(A, B, i){
  let p, q;
  if (B[i] === 0) { p = 0; q = 1; }
  else { p = -B[i]; q = A[i]; const g0 = gcdI(p, q) || 1; p /= g0; q /= g0; }
  let r = A.map((a, j) => p * a + q * B[j]);
  const f = r.slice(0, 3).find(v => v !== 0); if (f < 0) { p = -p; q = -q; r = r.map(v => -v); }
  const g = r.reduce((s, v) => gcdI(s, v), 0) || 1;
  return { p, q, g, r: r.map(v => v / g) };
}
// A 3 × 3 integer system by the textbook plan: (4) from (1), (2); (5) from (1), (3), both without x; (6) from (4), (5)
// without y; then z, y from (4), x from (1). null unless that plan works (a₁ ≠ 0, b₄ ≠ 0, c₆ ≠ 0). x, y, z exact (Q).
function elim3(E){
  if (E[0][0] === 0) return null;
  const s4 = elimStep(E[0], E[1], 0), s5 = elimStep(E[0], E[2], 0); if (s4.r[1] === 0) return null;
  const s6 = elimStep(s4.r, s5.r, 1); if (s6.r[2] === 0 || s6.r[1] !== 0) return null;
  const z = Q(s6.r[3], s6.r[2]), y = Q.div(Q.sub(s4.r[3], Q.mul(s4.r[2], z)), s4.r[1]);
  const x = Q.div(Q.sub(Q.sub(E[0][3], Q.mul(E[0][1], y)), Q.mul(E[0][2], z)), E[0][0]);
  return { s4, s5, s6, x, y, z };
}
// Equations in quadratic form: turn a root u = r (Q) of the u-equation into x-values. kind: "sq" (u = x²),
// "lin" (u = x − h), "sqrt" (u = √x), "cbrt" (u = ∛x), "inv" (u = 1/x).
// → {xs: [{v, t, h}], rej: reason | null, cand: (for √x = r < 0, the squared candidate x = r²)}
function backSub(kind, r, h = 0){
  r = Q(r); const v = Q.val(r), one = q => ({ v: Q.val(q), t: qT(q), h: qT(q) });
  if (kind === "sq") {
    if (v < 0) return { xs: [], rej: "a square is never negative" };
    if (v === 0) return { xs: [one(Q(0))], rej: null };
    const s = sqrtQ(r), p = radFrac(s.s, s.t), m = Q.val(s.s) * Math.sqrt(s.t);
    return { xs: [{ v: -m, t: MI + p.t, h: MI + p.h }, { v: m, t: p.t, h: p.h }], rej: null };
  }
  if (kind === "lin") return { xs: [one(Q.add(r, h))], rej: null };
  if (kind === "sqrt") return v < 0 ? { xs: [], rej: "a principal square root is never negative", cand: Q.mul(r, r) } : { xs: [one(Q.mul(r, r))], rej: null };
  if (kind === "cbrt") return { xs: [one(Q.pow(r, 3))], rej: null };
  if (kind === "inv") return v === 0 ? { xs: [], rej: "1/x is never 0" } : { xs: [one(Q.inv(r))], rej: null };
  throw new Error("backSub: unknown kind " + kind);
}
// s·√t (s a positive rational Q, t square-free) as a rationalised fraction, text and HTML: radFrac(Q(1, 2), 2) → {t: "√2/2", h}
function radFrac(s, t){
  if (t === 1) return { t: qT(s), h: qT(s) };
  const num = (s.n === 1 ? "" : s.n) + "√" + t, numH = (s.n === 1 ? "" : s.n) + `√<span class="mk-ol">${t}</span>`;
  return { t: s.d === 1 ? num : `${num}/${s.d}`, h: s.d === 1 ? numH : `<span class="fr"><span>${numH}</span><span>${s.d}</span></span>` };
}
// A number in compact scientific text: sci(3162277.66) = "3.16 × 10⁶", sci(31.62) = "31.6", sci(1e14) = "10¹⁴".
function sci(v, sig = 3){
  if (v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v)) + 1e-9);
  if (e >= -3 && e < 6) return (+v.toPrecision(sig)).toLocaleString("en-US", { maximumFractionDigits: 6 }).replace("-", MI);
  let m = +(v / 10 ** e).toPrecision(sig), ee = e; if (Math.abs(m) >= 10) { m = +(m / 10).toPrecision(sig); ee++; }
  return (m === 1 ? "" : String(m).replace("-", MI) + " × ") + "10" + supT(String(ee));
}

/* exponentials and logs: e, exact log points and drills, equations, compound interest */
// (1 + 1/n)ⁿ computed stably (log1p keeps 9+ correct decimals up to n = 10⁶ and beyond).
const compoundE = n => Math.exp(n * Math.log1p(1 / n));
// Truncated decimal digits of v and how many leading characters agree with e: eDigits(2.71828047) → {text: "2.718280469", chars: 7, decimals: 5}
function eDigits(v, dec = 9){
  const s = String(Math.floor(v * 10 ** dec + 1e-7)), es = String(Math.floor(Math.E * 10 ** dec));
  let m = 0; while (m < s.length && s[m] === es[m]) m++;
  return { text: s[0] + "." + s.slice(1), chars: m ? m + 1 : 0, decimals: Math.max(0, m - 1) };
}
// Exact points {x: Q, y: Q} of y = log_b x (b a rational Q) with x in [lo, hi]: x = b^m, and b^(m/2) when √b is rational.
function logPoints(b, lo, hi){
  const out = [], rt = sqrtQ(b);
  const add = (x, y) => { const v = Q.val(x); if (v >= lo && v <= hi) { const e = logExact(b, x); if (e && Q.eq(e, y)) out.push({ x, y }); } };
  for (let m = -12; m <= 12; m++) { add(Q.pow(b, m), Q(m)); if (rt.t === 1 && m % 2) add(Q.pow(rt.s, m), Q(m, 2)); }
  return out;
}
// Exact-log drill cases: log_b x with b = c^p ≤ 1000, x = c^q (c = 2, 3, 5, 10), answer y = q/p. [{c, p, q, b, x, y}]
function logCases(){
  const out = [];
  [2, 3, 5, 10].forEach(c => [1, 2, 3].forEach(p => { const b = c ** p; if (b > 1000) return;
    for (let q = -3; q <= 4; q++) { if (q === 0 || q === p || c ** Math.abs(q) > 1000) continue;
      const x = Q.pow(Q(c), q), y = logExact(Q(b), x); if (y && Q.eq(y, Q(q, p))) out.push({ c, p, q, b, x, y }); } }));
  return out;
}
// √(x + a) = x + b for integers a, b: squaring gives x² + (2b − 1)x + (b² − a) = 0, D = 4(a − b) + 1.
// → {D, cands: [{v, t, ok, lhs, rhs}], sol}: a candidate is a solution only if √(v + a) = v + b (so v + b ≥ 0).
function radicalEq(a, b){
  const D = 4 * (a - b) + 1, N = 1 - 2 * b;
  if (D < 0) return { D, cands: [], sol: [] };
  const [m, r] = sqrtParts(D);
  const cands = [-1, 1].map(s => {
    const v = (N + s * Math.sqrt(D)) / 2, lhs = Math.sqrt(Math.max(0, v + a)), rhs = v + b;
    const t = r === 1 ? qT(Q(N + s * m, 2)) : `(${sg(N)} ${s < 0 ? MI : "+"} ${m === 1 ? "" : m}√${r})/2`;
    return { v, t, ok: rhs >= -1e-12 && Math.abs(lhs - rhs) < 1e-9, lhs, rhs };
  });
  return { D, cands, sol: cands.filter(q => q.ok) };
}
// log_b(x + p) + log_b(x + q) = n ⇒ (x + p)(x + q) = bⁿ: {V, D, s, r, lo} with integer roots s (in the domain x > lo)
// and r (extraneous: both factors negative), or null when the roots are not integers or not split that way.
function logSumEq(b, p, q, n){
  const V = b ** n, D = (p - q) ** 2 + 4 * V, sq = Math.round(Math.sqrt(D));
  if (sq * sq !== D || (sq - p - q) % 2) return null;
  const s = (-(p + q) + sq) / 2, r = (-(p + q) - sq) / 2, lo = Math.max(-p, -q);
  return s > lo && r < Math.min(-p, -q) ? { V, D, s, r, lo } : null;
}
// (cᵖ)^(x + h1) = (c^q)^(x + h2), or = cⁿ when q = 0: equate exponents; the exact x (Q), or null when no single solution.
const sameBaseX = (p, h1, q, h2, n) => { const a1 = p, b1 = p * h1, a2 = q, b2 = q ? q * h2 : n; return a1 === a2 ? null : Q(b2 - b1, a1 - a2); };
// b^(2x) − (u1 + u2)·bˣ + u1·u2 = 0 with u = bˣ: only u > 0 gives x = log_b u. → {keep: [{u, x}], drop: [u]}
function quadExpRoots(b, u1, u2){
  const keep = [], drop = [];
  [u1, u2].sort((a, c) => a - c).forEach(u => { if (u > 0) keep.push({ u, x: Math.log(u) / Math.log(b) }); else drop.push(u); });
  return { keep, drop };
}
// Annual percentage yield and doubling time at rate r, n periods a year (n = Infinity: continuous)
const apy = (r, n) => (n === Infinity ? Math.exp(r) - 1 : Math.pow(1 + r / n, n) - 1);
const doublingTime = (r, n) => (n === Infinity ? Math.LN2 / r : Math.LN2 / (n * Math.log1p(r / n)));
// Balance after t years when interest is paid at the end of each period (a step function of t; continuous for n = Infinity)
const periodBalance = (P, r, n, t) => (n === Infinity ? P * Math.exp(r * t) : P * Math.pow(1 + r / n, n * Math.floor(n * t + 1e-9) / n));

/* sequences, series, binomial */
// Positive-integer n with n/2·(2a₁ + (n − 1)d) = S: d·n² + (2a₁ − d)·n − 2S = 0. → {A, B, C, D, roots (ascending),
// n (the valid count or null), rejected}. A root counts only if a positive integer and (o.positive) every term stays > 0.
function arithSolveN(a1, d, S, o = {}){
  const A = d, B = 2 * a1 - d, Cc = -2 * S;
  let roots;
  if (A === 0) roots = B ? [-Cc / B] : [];
  else { const D = B * B - 4 * A * Cc; if (D < 0) roots = []; else { const s = Math.sqrt(D); roots = [(-B - s) / (2 * A), (-B + s) / (2 * A)].sort((p, q) => p - q); } }
  const ok = r => Math.abs(r - Math.round(r)) < 1e-9 && Math.round(r) >= 1 && (!o.positive || a1 + (Math.round(r) - 1) * d > 0);
  const good = roots.filter(ok).map(Math.round);
  return { A, B, C: Cc, D: B * B - 4 * A * Cc, roots, n: good.length ? good[0] : null, rejected: roots.filter(r => !ok(r)) };
}
// Repeating decimal int.pre(rep)(rep)… as a geometric series: head = int.pre, a₁ = rep/10^(p+q), r = 1/10^q.
// repDecimal(0, "", "36") → {head: 0, a1: 36/100, r: 1/100, tail: 4/11, value: 4/11, raw: 36/99, p, q}
function repDecimal(int, pre, rep){
  const p = pre.length, q = rep.length;
  const head = Q.add(Q(int), Q(pre ? +pre : 0, 10 ** p)), a1 = Q(+rep, 10 ** (p + q)), r = Q(1, 10 ** q);
  const tail = Q.div(a1, Q.sub(1, r));
  return { head, a1, r, tail, value: Q.add(head, tail), raw: Q(+rep, 10 ** q - 1), p, q };
}
// Exact geometric partial sum S_n when the numbers stay inside safe integers, else null (use the decimal value).
function geomExact(a1, r, n){
  r = Q(r); a1 = Q(a1);
  if (Math.pow(Math.max(Math.abs(r.n), r.d), n) * Math.max(Math.abs(a1.n), a1.d) * 64 > 9e15) return null;
  return geom(a1, r).sum(n);
}
// The m-th (0-based, lexicographic) of the C(n, k) lattice paths from the top of Pascal's triangle to entry (n, k):
// n letters, "a" (down-left) or "b" (down-right), with k b's.
function pascalPath(n, k, m){
  const out = []; let kk = k;
  for (let i = n; i > 0; i--) { const withA = nCr(i - 1, kk); if (kk < i && m < withA) out.push("a"); else { if (kk < i) m -= withA; out.push("b"); kk--; } }
  return out;
}
// Monomial c·u^e1·v^e2… with superscript digits; variables in <i> when html. monoStr(−160, [["a", 3], ["b", 3]]) → "−160a³b³" (italic)
function monoStr(c, parts, html = true){
  const vars = parts.filter(([u, e]) => u && e > 0);
  const vs = vars.map(([u, e]) => (html ? `<i>${u}</i>` : u) + (e === 1 ? "" : supT(e))).join("");
  if (!vs) return (c < 0 ? MI : "") + Math.abs(c);
  return (c < 0 ? MI : "") + (Math.abs(c) === 1 ? "" : Math.abs(c)) + vs;
}

W.MathRules = { Q, Poly, Z, gcd: gcdI, lcm: lcmI, divisors, sqrtParts, sqrtQ, quadRoots, rational, transform, transformPoint, compose, invert, isOneToOne,
  logb, logExact, compound, continuous, arith, geom, sigma, nCr, pascalRow, binomialPoly, binomialTerm, conic, conicGeneral,
  zeros, intersect, niceStep, ticks, placeLabels, sg, fmtN, qT, qH, supT, polyT, polyH, polyStr, zT, zH, radStr, rootsStr, factorStr, reveal, MI,
  sameGraph, RS, rootTestOrder, synthDistractors, factorPlan, leadStr, factoredStr, groupZeros, turningPoints, polySymmetry, signPattern, endsStr,
  signIntervals, asymCross, VARIATION, variation, INEQ, INEQ_FLIP, criticalValues, testValue, solveIneq, ineqSetStr, factorIntStr,
  vertexForm, vertexFormStr, shiftStr, sqShiftStr, sqrtQStr, conicStdForm, pmRootStr, pmPairStr, generalFormH, conicSystem,
  linSolve, elimStep, elim3, backSub, radFrac, sci, compoundE, eDigits, logPoints, logCases, radicalEq, logSumEq, sameBaseX, quadExpRoots,
  apy, doublingTime, periodBalance, arithSolveN, repDecimal, geomExact, pascalPath, monoStr };

/* ---------------- 2. MathKit: math-only drawing on top of the universal/categorical kits ---------------- */
const CSS = `.mk-ol{border-top:1px solid currentColor;padding-top:1px;margin-left:1px}
.mk-wrap{display:flex;flex-wrap:wrap;gap:14px 22px;justify-content:center;align-items:flex-start;padding:54px 16px 56px;height:100%;overflow:auto;box-sizing:border-box}
.mk-chip{display:inline-block;border:1px solid;border-radius:4px;padding:0 7px;margin:2px 3px;font:400 17px/1.5 var(--math)}
table.mk-synth{border-collapse:collapse;font:400 18px/1.5 var(--math);margin:4px 0}
table.mk-synth td{padding:2px 10px;text-align:right;min-width:2.2em}
table.mk-synth td.r{border-right:1px solid var(--muted)} table.mk-synth tr.b td{border-top:1px solid var(--muted)}`;

function attach(k){
  const { C, F } = k;
  if (!document.getElementById("mk-css")) { const s = document.createElement("style"); s.id = "mk-css"; s.textContent = CSS; document.head.appendChild(s); }
  k.MR = W.MathRules;
  // Complex plane: equal scale, axes labelled Re / Im. P.z(z, color, label) draws a point (and an arrow when opt.vec).
  k.cplane = (c, o = {}) => {
    const P = k.plane(c, Object.assign({ equal: true, xlabel: "Re", ylabel: "Im" }, o));
    P.z = (z, color = C.amber, opt = {}) => { const v = z.isZ ? Z.val(z) : z; if (opt.vec) { c.d.arrow(P.X(0), P.Y(0), P.X(v.re), P.Y(v.im), color, opt.w || 2); P.seg(0, 0, v.re, v.im, "rgba(0,0,0,0)", 0); } P.dot(v.re, v.im, color, opt.r || 5.5); };
    return P;
  };

  // Synthetic-division table as HTML (top row, carried row, result row), `upto` columns revealed.
  k.synthHTML = (S, r, upto = Infinity) => { const cell = (q, i) => (i <= upto && q ? qH(q) : ""); return `<table class="mk-synth"><tr><td class="r">${qH(r)}</td>${S.top.map(q => `<td>${qH(q)}</td>`).join("")}</tr><tr><td class="r"></td>${S.mid.map((q, i) => `<td>${cell(q, i)}</td>`).join("")}</tr><tr class="b"><td class="r"></td>${S.bottom.map((q, i) => `<td${i === S.bottom.length - 1 ? ' class="c1"' : ""}>${cell(q, i)}</td>`).join("")}</tr></table>`; };
  return k;
}

W.MathKit = { attach };
})();
