// Logic tests for the math lab kit's rules (web/kits/subjects/math.js → MathRules).
const MR = load(...kits(), 'web/kits/subjects/math.js').MathRules;
const { Q, Poly, Z } = MR;
const S = q => q.toString(), PS = p => p.map(S);
const near = (a, b, what, tol = 1e-9) => ok(Math.abs(a - b) < tol, `${what}: got ${a}, want ${b}`);

test('rationals: reduce, sign, arithmetic, decimals', () => {
  eq(S(Q(6, -8)), '-3/4', 'sign to numerator'); eq(S(Q(0, 5)), '0', 'zero'); eq(S(Q(0.75)), '3/4', 'decimal'); eq(S(Q(-0.125)), '-1/8', 'neg decimal'); eq(S(Q(1 / 3)), '1/3', 'repeating');
  eq(S(Q.add(Q(1, 6), Q(1, 4))), '5/12', 'add'); eq(S(Q.sub(1, Q(1, 3))), '2/3', 'sub'); eq(S(Q.mul(Q(2, 3), Q(9, 4))), '3/2', 'mul'); eq(S(Q.div(Q(2, 3), Q(4, 9))), '3/2', 'div');
  eq(S(Q.pow(Q(2, 3), 3)), '8/27', 'pow'); eq(S(Q.pow(Q(2, 3), -2)), '9/4', 'neg pow'); ok(Q.lt(Q(1, 3), Q(1, 2)), 'lt'); eq(Q.cmp(Q(2, 4), Q(1, 2)), 0, 'cmp eq');
  let threw = false; try { Q.div(1, 0); } catch (e) { threw = true; } ok(threw, 'divide by zero throws');
});

test('polynomials: arithmetic, evaluation, composition', () => {
  const p = Poly([1, -3, 2]);            // 2x² − 3x + 1
  eq(PS(Poly.mul(Poly([-1, 1]), Poly([1, 1]))), ['-1', '0', '1'], '(x−1)(x+1)');
  eq(S(Poly.eval(p, Q(1, 2))), '0', 'p(1/2)'); eq(Poly.evalN(p, 3), 10, 'p(3)');
  eq(PS(Poly.deriv(p)), ['-3', '4'], "p'"); eq(PS(Poly.deriv(Poly([5]))), ['0'], 'constant derivative');
  eq(PS(Poly.compose(Poly([0, 0, 1]), Poly([1, 1]))), ['1', '2', '1'], '(x+1)²'); eq(PS(Poly.pow(Poly([1, 1]), 3)), ['1', '3', '3', '1'], '(x+1)³');
  eq(Poly.deg(Poly([0])), -Infinity, 'deg 0 poly'); eq(Poly.deg(Poly([1, 0, 0])), 0, 'trailing zeros trimmed');
  eq(MR.polyT(Poly([5, -1, 0, 2])), '2x³ − x + 5', 'text'); eq(MR.polyT(Poly([0, -1])), '−x', 'leading minus'); eq(MR.polyT(Poly([Q(1, 2), 0, -3])), '−3x² + 1/2', 'fraction');
  eq(MR.polyH(Poly([0, 0, 1])), '<i>x</i><sup>2</sup>', 'html');
});

test('long and synthetic division agree (remainder theorem)', () => {
  for (let trial = 0; trial < 60; trial++) {
    const deg = 1 + trial % 4, cs = Array.from({ length: deg + 1 }, (_, i) => ((trial * 7 + i * 13) % 11) - 5); if (cs[deg] === 0) cs[deg] = 2;
    const p = Poly(cs), r = Q((trial % 9) - 4, 1 + trial % 3);
    const L = Poly.divmod(p, Poly([Q.neg(r), 1])), Sy = Poly.synth(p, r);
    eq(PS(Sy.q), PS(L.q), 'quotients ' + cs + ' / (x − ' + r + ')'); eq(S(Sy.rem), S(Poly.eval(p, r)), 'remainder = p(r)');
    ok(Poly.eq(Poly.add(Poly.mul(L.q, Poly([Q.neg(r), 1])), L.r), p), 'p = q·d + r');
  }
  const D = Poly.divmod(Poly([-4, 0, -2, 1]), Poly([1, 0, 1]));   // (x³ − 2x² − 4) ÷ (x² + 1)
  eq(PS(D.q), ['-2', '1'], 'quotient x − 2'); eq(PS(D.r), ['-2', '-1'], 'remainder −x − 2'); eq(D.steps.length, 2, 'two steps');
  const T = Poly.synth(Poly([-6, 11, -6, 1]), 1); eq(PS(T.bottom), ['1', '-5', '6', '0'], 'synthetic bottom row'); eq(T.mid.map(x => x && S(x)), [null, '1', '-5', '6'], 'carried row');
});

test('rational roots, multiplicities, numeric roots', () => {
  eq(Poly.ratCandidates(Poly([-6, 11, -6, 2])).map(S).slice(0, 4), ['-6', '-3', '-2', '-3/2'], 'candidates ±p/q');
  const R = Poly.ratRoots(Poly.fromRoots([Q(1, 2), 2, 2, -3], 4)); eq(R.roots.map(o => [S(o.r), o.m]), [['-3', 1], ['1/2', 1], ['2', 2]], 'roots with multiplicity'); eq(PS(R.rest), ['4'], 'rest is the leading coefficient');
  const p = Poly.mul(Poly([-2, 0, 1]), Poly([3, 1]));   // (x² − 2)(x + 3)
  const rr = Poly.realRoots(p); eq(rr.length, 3, 'three real roots'); near(rr[0].x, -3, 'x=−3'); eq(S(rr[0].q), '-3', 'exact'); near(rr[1].x, -Math.SQRT2, '−√2'); eq(rr[1].q, null, 'irrational is numeric'); near(rr[2].x, Math.SQRT2, '√2');
  const cz = Poly.roots(Poly([5, -2, 1]));   // x² − 2x + 5 → 1 ± 2i
  eq(cz.length, 2, 'two complex'); near(cz[0].re, 1, 're'); near(Math.abs(cz[0].im), 2, 'im');
  eq(Poly.realRoots(Poly([0, 0, 0, 1])).map(o => o.m), [3], 'x³ triple root at 0');
  const four = Poly.roots(Poly.fromRoots([1, 2, 3, 4])); four.forEach((z, i) => near(z.re, i + 1, 'root ' + (i + 1), 1e-8));
  eq(Poly.ends(Poly([0, 0, 0, -2])), { left: 1, right: -1 }, '−2x³ ends'); eq(Poly.ends(Poly([1, 0, 3])), { left: 1, right: 1 }, '3x² ends');
});

test('complex numbers, exact', () => {
  const a = Z(3, -4), b = Z(1, 2);
  eq(MR.zT(Z.add(a, b)), '4 − 2i', 'add'); eq(MR.zT(Z.mul(a, b)), '11 + 2i', 'mul'); eq(MR.zT(Z.div(a, b)), '−1 − 2i', 'div'); eq(S(Z.norm(a)), '25', '|a|²'); near(Z.abs(a), 5, '|a|');
  eq([0, 1, 2, 3, 4, 5, -1].map(e => MR.zT(Z.ipow(e))), ['1', 'i', '−1', '−i', '1', 'i', '−i'], 'powers of i');
  eq(MR.zT(Z.pow(Z(1, 1), 4)), '−4', '(1+i)⁴'); eq(MR.zT(Z.div(1, Z(0, 1))), '−i', '1/i'); eq(MR.zT(Z(Q(1, 2), Q(-3, 2))), '1/2 − 3/2i', 'fractions'); eq(MR.zT(Z(0, 1)), 'i', 'i'); eq(MR.zT(Z(0, -2)), '−2i', '−2i');
  ok(Z.eq(Z.mul(a, Z.conj(a)), Z(25)), 'z·z̄ = |z|²');
});

test('radicals and exact quadratic roots', () => {
  eq(MR.sqrtParts(72), [6, 2], '√72'); const sq = MR.sqrtQ(Q(9, 8)); eq([S(sq.s), sq.t], ['3/4', 2], '√(9/8) = (3/4)√2'); eq([S(MR.sqrtQ(Q(25, 4)).s), MR.sqrtQ(Q(25, 4)).t], ['5/2', 1], '√(25/4)');
  for (let n = 0; n < 40; n++) for (let dd = 1; dd < 12; dd++) { const r = MR.sqrtQ(Q(n, dd)); near(Q.val(r.s) * Math.sqrt(r.t), Math.sqrt(n / dd), 'sqrtQ ' + n + '/' + dd, 1e-12); } eq(MR.sqrtParts(49), [7, 1], '√49'); eq(MR.sqrtParts(30), [1, 30], '√30');
  const r1 = MR.quadRoots(1, -5, 6); eq(r1.kind, 'two rational'); eq(r1.exact.map(S), ['2', '3'], 'x²−5x+6');
  const r2 = MR.quadRoots(1, 2, -11); eq(r2.kind, 'two irrational'); eq([S(r2.p), S(r2.s), r2.t], ['-1', '2', 3], '−1 ± 2√3'); eq(MR.rootsStr(r2), '−1 ± 2√3', 'text');
  const r3 = MR.quadRoots(1, -4, 5); eq(r3.kind, 'complex'); eq(MR.rootsStr(r3), '2 ± i', '2 ± i');
  const r4 = MR.quadRoots(4, 12, 9); eq(r4.kind, 'double'); eq(MR.rootsStr(r4), '−3/2', 'double root');
  const r5 = MR.quadRoots(2, 0, 3); eq(MR.rootsStr(r5), '±1/2√6i', '±(√6/2)i');
  for (let a = 1; a <= 3; a++) for (let b = -6; b <= 6; b++) for (let c = -6; c <= 6; c++) { const R = MR.quadRoots(a, b, c); for (const v of R.values) { const re = a * (v.re * v.re - v.im * v.im) + b * v.re + c, im = a * 2 * v.re * v.im + b * v.im; ok(Math.abs(re) < 1e-9 && Math.abs(im) < 1e-9, `root of ${a}x²+${b}x+${c}`); } }
});

test('rational functions: holes, asymptotes, zeros', () => {
  const f = MR.rational([-4, 0, 1], [-6, 1, 1]);   // (x²−4)/(x²+x−6) = (x+2)/(x+3), hole at x=2
  eq(f.holes.map(h => [S(h.q), S(h.yq)]), [['2', '4/5']], 'hole (2, 4/5)'); eq(f.vas.map(v => S(v.q)), ['-3'], 'VA x=−3'); eq(f.zeros.map(z => S(z.q)), ['-2'], 'zero −2');
  eq(f.asym.type, 'horizontal'); eq(S(f.asym.y), '1', 'HA y=1'); eq(S(f.yint), '2/3', 'y-intercept'); eq(f.excluded.map(e => S(e.q)), ['-3', '2'], 'domain excludes'); ok(isNaN(f.f(2)), 'f undefined at hole');
  eq([f.vas[0].left, f.vas[0].right], [1, -1], 'sides of VA: (x+2)/(x+3) → +∞ left, −∞ right');
  const g = MR.rational([1, 0, 1], [0, 1]); eq(g.asym.type, 'slant'); eq(PS(g.asym.poly), ['0', '1'], 'slant y = x'); eq(g.yint, null, 'no y-intercept');
  const h = MR.rational([1], [0, 0, 1]); eq(h.holes.length, 0, '1/x² has no hole'); eq(h.vas.map(v => v.m), [2], 'even VA'); eq([h.vas[0].left, h.vas[0].right], [1, 1], 'both sides +∞');
  const k2 = MR.rational([0, 1], [0, 0, 1]); eq(k2.holes.length, 0, 'x/x²: x=0 is a VA, not a hole'); eq(k2.vas.map(v => S(v.q)), ['0'], 'VA 0');
  const m = MR.rational([3, 0, 2], [1, 0, -1]); eq(S(m.asym.y), '-2', 'HA ratio of leads'); eq(m.vas.map(v => S(v.q)), ['-1', '1'], 'VAs ±1');
});

test('transformations, inverses, logs', () => {
  const f = x => x * x, g = MR.transform(f, { a: 2, b: 1, h: 3, k: -1 }); eq(g(3), -1, 'vertex moves to (3,−1)'); eq(g(4), 1, 'g(4)');
  eq(MR.transformPoint([1, 1], { a: 2, b: 2, h: 3, k: -1 }), [3.5, 1], 'point map x/b + h, a·y + k');
  near(MR.invert(x => x * x * x + x, 10, -5, 5), 2, 'inverse of x³+x at 10'); ok(isNaN(MR.invert(x => x * x, -1, 0, 3)), 'out of range');
  ok(MR.isOneToOne(x => x * x * x, -3, 3), 'x³ one-to-one'); ok(!MR.isOneToOne(x => x * x, -3, 3), 'x² not one-to-one'); ok(MR.isOneToOne(x => x * x, 0, 3), 'x² on [0,3]');
  eq(S(MR.logExact(8, 4)), '2/3', 'log₈4'); eq(S(MR.logExact(2, Q(1, 8))), '-3', 'log₂(1/8)'); eq(S(MR.logExact(Q(1, 9), 27)), '-3/2', 'log_{1/9}27'); eq(MR.logExact(2, 3), null, 'log₂3 irrational');
  near(MR.logb(10, 1000), 3, 'log 1000'); near(MR.compound(1000, .05, 12, 10), 1647.00949769028, 'compound'); near(MR.continuous(1000, .05, 10), 1648.721270700128, 'continuous');
});

test('sequences, series, binomial', () => {
  const A = MR.arith(3, 4); eq(S(A.term(10)), '39', 'a10'); eq(S(A.sum(10)), '210', 'S10'); eq(S(MR.sigma(i => 3 + 4 * (i - 1), 1, 10)), '210', 'sigma agrees');
  const G = MR.geom(Q(1, 2), Q(1, 2)); eq(S(G.term(5)), '1/32', 'g5'); eq(S(G.sum(5)), '31/32', 'S5'); eq(S(G.sumInf()), '1', 'infinite sum'); eq(MR.geom(1, 2).sumInf(), null, 'diverges');
  eq(S(MR.geom(5, 1).sum(4)), '20', 'r = 1'); eq(S(MR.sigma(i => Q(1, i * (i + 1)), 1, 9)), '9/10', 'telescoping');
  eq(MR.pascalRow(5), [1, 5, 10, 10, 5, 1], 'row 5'); eq(MR.nCr(20, 10), 184756, 'C(20,10)'); eq(MR.nCr(5, 7), 0, 'C(5,7)');
  eq(PS(MR.binomialPoly(2, -1, 3)), ['-1', '6', '-12', '8'], '(2x − 1)³'); eq(S(MR.binomialTerm(Q(2), Q(-3), 5, 2)), '720', 'C(5,2)·2³·(−3)²');
});

test('conic sections from general form', () => {
  const c = MR.conic({ A: 1, C: 1, D: -4, E: 6, F: -12 }); eq(c.type, 'circle'); eq([S(c.h), S(c.k), S(c.r2)], ['2', '-3', '25'], 'centre (2,−3), r²=25');
  const e = MR.conic({ A: 9, C: 4, D: -36, E: 8, F: 4 }); eq(e.type, 'ellipse'); eq([S(e.h), S(e.k), S(e.a2), S(e.b2), S(e.c2), e.axis], ['2', '-1', '9', '4', '5', 'vertical'], 'ellipse (x−2)²/4 + (y+1)²/9 = 1');
  const h = MR.conic({ A: 1, C: -4, D: 0, E: 0, F: -16 }); eq(h.type, 'hyperbola'); eq([S(h.a2), S(h.b2), S(h.c2), h.axis], ['16', '4', '20', 'horizontal'], 'x²/16 − y²/4 = 1'); near(h.asymptotes[0].m, .5, 'asymptote slope b/a');
  const hv = MR.conic({ A: -1, C: 4, F: -4 }); eq([hv.type, hv.axis, S(hv.a2), S(hv.b2)], ['hyperbola', 'vertical', '1', '4'], 'y² − x²/4 = 1'); near(hv.asymptotes[0].m, .5, 'vertical asymptote slope a/b');
  const p = MR.conic({ A: 1, D: -4, E: -8, F: 12 }); eq(p.type, 'parabola'); eq([S(p.h), S(p.k), S(p.p), p.axis], ['2', '1', '2', 'vertical'], '(x−2)² = 8(y−1)'); eq(p.focus, [2, 3], 'focus'); eq(p.directrix, { y: -1 }, 'directrix');
  const ph = MR.conic({ C: 1, D: 12 }); eq([ph.type, ph.axis, S(ph.p)], ['parabola', 'horizontal', '-3'], 'y² = −12x'); eq(ph.focus, [-3, 0], 'focus (−3,0)');
  eq(MR.conic({ A: 1, C: 1, F: 4 }).type, 'empty', 'x²+y²=−4'); eq(MR.conic({ A: 1, C: 1 }).type, 'degenerate', 'point');
  for (const [kind, o] of [['ellipse', { h: 1, k: -2, X2: 9, Y2: 4 }], ['hyperbola', { h: -1, k: 3, X2: 4, Y2: -9 }]]) { const G = MR.conicGeneral(kind, o), back = MR.conic(G); eq([back.type, S(back.h), S(back.k)], [kind, String(o.h), String(o.k)], 'round trip ' + kind); }
  const pg = MR.conic(MR.conicGeneral('parabolaV', { h: 2, k: 1, p: 2 })); eq([pg.type, S(pg.h), S(pg.k), S(pg.p)], ['parabola', '2', '1', '2'], 'round trip parabola');
});

test('numeric zeros and intersections', () => {
  const z = MR.zeros(x => x * x * x - x, -3, 3); eq(z.length, 3, 'three zeros'); [-1, 0, 1].forEach((v, i) => near(z[i], v, 'zero ' + v, 1e-9));
  const t = MR.zeros(x => (x - 1) * (x - 1), -3, 3); eq(t.length, 1, 'touching zero found'); near(t[0], 1, 'double root', 1e-6);
  eq(MR.zeros(x => 1 / x, -2, 2).length, 0, 'pole is not a zero');
  const I = MR.intersect(x => x * x, x => x + 2, -5, 5); eq(I.map(p => Math.round(p.x)), [-1, 2], 'x² = x + 2');
});

test('ticks and label placement', () => {
  eq(MR.niceStep(20), 2, '20 → 2'); eq(MR.niceStep(7), 1, '7 → 1'); eq(MR.niceStep(0.9), 0.1, '0.9 → 0.1'); eq(MR.ticks(-1, 1, 0.5), [-1, -0.5, 0, 0.5, 1], 'ticks');
  const bounds = { x: 0, y: 0, w: 300, h: 200 };
  const L = MR.placeLabels([{ x: 100, y: 100, w: 40, h: 16 }, { x: 104, y: 100, w: 40, h: 16 }, { x: 98, y: 102, w: 40, h: 16 }], { bounds });
  const ov = (a, b) => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
  ok(!ov(L[0], L[1]) && !ov(L[0], L[2]) && !ov(L[1], L[2]), 'three labels at one point do not overlap');
  const edge = MR.placeLabels([{ x: 295, y: 5, w: 50, h: 16 }], { bounds })[0]; ok(edge.x >= 0 && edge.x + edge.w <= 300 && edge.y >= 0, 'label at the corner stays inside');
  const pts = []; for (let x = 0; x <= 300; x += 3) pts.push([x, 100 - (x - 100)]);   // a line through the anchor going up-right
  const c = MR.placeLabels([{ x: 100, y: 100, w: 30, h: 14 }], { bounds, pts })[0]; eq(c.cost < 1, true, 'finds a spot off the curve'); ok(!pts.some(([px, py]) => px > c.x && px < c.x + c.w && py > c.y && py < c.y + c.h), 'no curve sample under the label');
  const box = { x: 90, y: 60, w: 80, h: 40 }; const b = MR.placeLabels([{ x: 100, y: 100, w: 30, h: 14 }], { bounds, boxes: [box] })[0]; ok(!ov(b, box), 'avoids a box');
});

test('reveal guard and formatters', () => {
  eq([MR.factorStr(3), MR.factorStr(-2), MR.factorStr(Q(1, 2)), MR.factorStr(Q(-1, 2), { integer: true }), MR.factorStr(0)], ['x − 3', 'x + 2', 'x − 1/2', '2x + 1', 'x'], 'factorStr');
  eq(MR.reveal(['a', 'b', 'c'], 0), ['a', null, null], 'only the first step'); eq(MR.reveal(['a', 'b', 'c'], 2), ['a', 'b', 'c'], 'all');
  eq(MR.fmtN(-0.0001, 2), '0', 'no negative zero'); eq(MR.fmtN(-2.5, 1), '−2.5', 'unicode minus'); eq(MR.qT(Q(-3, 4)), '−3/4', 'qT'); eq(MR.radStr(Q(3), 2), '3√2', 'radStr'); eq(MR.radStr(Q(-1), 5), '−√5', '−√5');
  ok(MR.qH(Q(-1, 2)).includes('class="fr"'), 'qH fraction markup'); eq(MR.zH(Z(2, -1)), '<span class="m">2</span> − <i>i</i>', 'zH');
});

// ---------- rules moved from the Algebra II labs (a2-b1 … a2-b12) ----------
test('sameGraph: same values and same domain', () => {
  ok(MR.sameGraph(x => (x * x - 1) / (x - 1), x => x + 1, -5, 5), 'hole at 1 is not sampled: same graph');
  ok(!MR.sameGraph(x => Math.sqrt(x) ** 2, x => x, -5, 5), 'different domains');
  ok(!MR.sameGraph(x => x, x => x + 1e-3, -5, 5), 'different values');
  ok(!MR.sameGraph(x => NaN, x => NaN, -5, 5), 'nowhere defined: not a graph');
});

test('interval sets RS: intersection, union, membership, text', () => {
  const R = MR.RS, e = R.ep;
  eq(R.str(R.ALL()), '(−∞, ∞)', 'all reals'); eq(R.str([]), '∅', 'empty set');
  eq(R.str(R.ge(e(2))), '[2, ∞)', 'ge closed'); eq(R.str(R.ge(e(Q(-1, 2)), true)), '(−1/2, ∞)', 'ge strict, fraction');
  eq(R.str(R.ne(e(3), e(-1))), '(−∞, −1) ∪ (−1, 3) ∪ (3, ∞)', 'ne sorts its points');
  eq(R.root(8, -1).t, '−2√2', '−√8'); eq(R.root(9, 1).t, '3', '√9 is rational'); ok(R.root(5, 1).h.includes('mk-ol'), 'root html');
  const A = [{ lo: null, hi: e(2), hc: true }], B = R.ge(e(2));
  eq(R.str(R.and(A, B)), '{2}', 'touching closed ends meet in one point');
  eq(R.and(A, R.ge(e(2), true)), [], 'open end: empty intersection');
  eq(R.str(R.and(R.ne(e(0)), R.ge(e(-3)))), '[−3, 0) ∪ (0, ∞)', 'domain-style intersection');
  eq(R.str(R.or(A, R.ge(e(2), true))), '(−∞, ∞)', 'union of (−∞, 2] and (2, ∞)');
  eq(R.str(R.or([{ lo: null, hi: e(1), hc: false }], R.ge(e(1), true))), '(−∞, 1) ∪ (1, ∞)', 'both open at 1: the point stays out');
  eq(R.str(R.or([{ lo: e(0), hi: e(3), lc: true, hc: false }], [{ lo: e(1), hi: e(5), lc: false, hc: true }])), '[0, 5]', 'overlap merges');
  eq(R.str(R.or([{ lo: e(4), hi: e(6), lc: true, hc: true }], [{ lo: e(-2), hi: e(0), lc: false, hc: false }])), '(−2, 0) ∪ [4, 6]', 'disjoint pieces sorted');
  eq(R.str(R.or([{ lo: e(1), hi: e(1), lc: true, hc: true }], [{ lo: e(1), hi: e(4), lc: false, hc: false }])), '[1, 4)', 'a point closes an open end');
  eq(R.str(R.or([], [])), '∅', 'empty ∪ empty'); eq(R.str(R.or(R.ALL(), R.ge(e(3)))), '(−∞, ∞)', 'ℝ absorbs');
  eq(R.str(R.or([{ lo: e(2), hi: e(1), lc: true, hc: true }], [])), '∅', 'an empty piece is dropped');
  ok(R.has(A, 2) && !R.has(A, 2.001) && R.has(A, -1e9), 'has, closed end and −∞'); ok(!R.has(R.ne(e(0)), 0) && R.has(R.ne(e(0)), 0.5), 'has, excluded point');
  eq(R.str(R.ge(e(Q(1, 2))), true), '[<span class="fr"><span>1</span><span>2</span></span>, ∞)', 'html');
});

test('rational roots: test order, synthetic distractors, factoring plan', () => {
  eq(MR.rootTestOrder([Q(-2), Q(1, 2), Q(1), Q(-1), Q(2), Q(-1, 2)]).map(S), ['1', '-1', '2', '-2', '1/2', '-1/2'], 'integers first, by size, positive first');
  const p = Poly([-6, 11, -6, 1]);                       // (x − 1)(x − 2)(x − 3)
  const ds = MR.synthDistractors(p, 2); ok(ds.length === 3 && ds.every(o => !Q.eq(o.v, Poly.eval(p, 2)) && o.why), 'three wrong remainders with reasons');
  eq(S(ds[0].v), S(Poly.eval(p, Q(-2))), 'first: P(−r)');
  const gap = MR.synthDistractors(Poly([-4, 0, 0, 1]), 2); eq(gap.map(o => S(o.v)), ['-12', '-2', '0'], 'x³ − 4 ÷ (x − 2): P(−2), placeholders dropped (x − 4 at 2), last column not multiplied');
  ok(gap[1].why.includes('placeholders'), 'placeholder reason');
  const F = MR.factorPlan(Poly([-6, 11, -6, 1]));
  eq(F.factorsT, '(x − 1)(x − 2)(x − 3)', 'three rational zeros'); eq(F.stages.length, 1, 'one deflation to a quadratic'); ok(F.quad.rat, 'rational quadratic');
  eq(F.stages[0].root.toString(), '1', 'x = 1 found first'); eq(F.order.length, 8, '±1, ±2, ±3, ±6');
  const G = MR.factorPlan(Poly([-2, 1, -2, 1]));          // x³ − 2x² + x − 2 = (x − 2)(x² + 1)
  eq(G.factorsT, '(x − 2)(x² + 1)', 'irreducible quadratic kept'); eq(G.quad.R.kind, 'complex', 'complex pair');
  eq(G.stages[0].fails.map(o => S(o.c)), ['1', '-1'], 'failed tests before the zero');
  eq(MR.factorPlan(Poly([2, -3, -3, 2])).factorsT, '(x + 1)(2x − 1)(x − 2)', 'a fractional zero gives an integer factor');
  eq(MR.factorPlan(Poly([1, -3, 0, 4])).factorsT, '(x + 1)(2x − 1)²', 'repeated zero 1/2: squared factor, K = 1');
  eq(MR.factorPlan(Poly([-8, 0, 0, 1])).factorsT, '(x − 2)(x² + 2x + 4)', 'difference of cubes');
  eq(MR.factorPlan(Poly([-4, 4, -1])).quad.roots.map(S), ['2', '2'], 'quadratic input: double root');
  const N = MR.factorPlan(Poly([-4, 0, 0, 0, 1]));        // x⁴ − 4: no rational zero, nothing deflated
  eq([N.stages.length, Poly.deg(N.rest), N.quad], [0, 4, null], 'no rational zero: the quartic is left as the rest');
});

test('polynomial graphs: factored form, multiplicity, turning points, symmetry, signs, ends', () => {
  const g = MR.groupZeros([Q(-1), Q(3), Q(-1), Q(0)]);
  eq(g.map(o => [S(o.r), o.m]), [['-1', 2], ['3', 1], ['0', 1]], 'group equal zeros, first-seen order'); eq(MR.groupZeros([]), [], 'no zeros');
  eq(MR.factoredStr(Q(-2), g, false), '−2x(x + 1)²(x − 3)', 'x first, then by value');
  eq(MR.factoredStr(Q(-2), g, true), '−2<i>x</i>(<i>x</i> + 1)<sup>2</sup>(<i>x</i> − 3)', 'html');
  eq([MR.factoredStr(Q(1, 2), [{ r: Q(1, 2), m: 1 }]), MR.factoredStr(Q(5), []), MR.factoredStr(Q(1), []), MR.factoredStr(Q(-1), [{ r: Q(2), m: 3 }])], ['1/2(x − 1/2)', '5', '1', '−(x − 2)³'], 'lead forms and constants');
  eq([1, -1, Q(1, 2), -3].map(MR.leadStr), ['', '−', '1/2', '−3'], 'leadStr');
  eq(MR.turningPoints(Poly([0, -3, 0, 1])).map(o => o.x), [-1, 1], 'x³ − 3x turns at ±1');
  eq(MR.turningPoints(Poly([0, 0, 0, 1])), [], 'x³: p′ has a double zero, no sign change'); eq(MR.turningPoints(Poly([1, 1])), [], 'a line never turns');
  eq(MR.turningPoints(Poly([0, 0, 1])).map(o => o.x), [0], 'x² turns at 0');
  eq([Poly([1, 0, 2]), Poly([0, -3, 0, 1]), Poly([1, 1]), Poly([5])].map(MR.polySymmetry), ['even', 'odd', 'neither', 'even'], 'symmetry');
  eq(MR.signPattern(Poly([0, -1, 0, 1]), [-1, 0, 1]), ['−', '+', '−', '+'], 'x³ − x'); eq(MR.signPattern(Poly([1, 0, 1]), []), ['+'], 'no zeros');
  eq(MR.signPattern(Poly([0, 0, 1]), [0]), ['+', '+'], 'touching zero: no sign change');
  eq(MR.endsStr(Poly([0, 0, 0, -2])), 'x → −∞, f(x) → ∞; x → ∞, f(x) → −∞', 'odd degree, negative lead');
  eq(MR.endsStr(Poly([0, 0, 1]), true), '<i>x</i> → −∞, <i>f</i>(<i>x</i>) → ∞; <i>x</i> → ∞, <i>f</i>(<i>x</i>) → ∞', 'even degree, html');
});

test('rational functions: sign intervals and crossing the asymptote', () => {
  const brief = R => MR.signIntervals(R).map(o => [o.lo, o.hi, o.s]);
  eq(brief(MR.rational([-1, 0, 1], [-2, 1])), [[null, -1, -1], [-1, 1, 1], [1, 2, -1], [2, null, 1]], '(x² − 1)/(x − 2): ±∞ ends, signs alternate');
  eq(brief(MR.rational([-1, 1], [-1, 0, 1])), [[null, -1, -1], [-1, null, 1]], 'the hole at 1 is not a critical value');
  eq(brief(MR.rational([1, 0, 1], [1])), [[null, null, 1]], 'no critical values: one interval, test value 0');
  eq(brief(MR.rational([0, 0, 1], [1, 0, 1])), [[null, 0, 1], [0, null, 1]], 'touching zero: same sign on both sides');
  eq(MR.signIntervals(MR.rational([-1, 0, 1], [-2, 1])).map(o => o.t), [-2, 0, 1.5, 3], 'test values');
  eq(MR.asymCross(MR.rational([0, 2], [1, 0, 1])).map(z => z.x), [0], '2x/(x² + 1) crosses y = 0 at 0');
  near(MR.asymCross(MR.rational([2, -3, 1], [1, 0, 1]))[0].x, 1 / 3, '(x² − 3x + 2)/(x² + 1) crosses y = 1 at 1/3');
  eq(MR.asymCross(MR.rational([-4, -1, 1, 1], [-2, 0, 1])).map(z => z.x), [2], 'slant asymptote y = x + 1 crossed at 2');
  eq(MR.asymCross(MR.rational([1], [0, 1])), [], '1/x never meets y = 0');
  eq(MR.asymCross(MR.rational([-1, 0, 1], [0, 1])), [], '(x² − 1)/x never meets y = x');
  eq(MR.asymCross(MR.rational([0, 0, 0, 1], [1])), [], 'polynomial: no horizontal/slant asymptote');
  eq(MR.asymCross(MR.rational([0, -1, 0, 1], [-1, 0, 1])), [], 'the graph is its asymptote (zero remainder)');
});

test('variation: constant, values, doubling factor', () => {
  const row = t => { const V = MR.variation(t, 2, 12); return [S(V.k), S(V.y(4)), V.f(4), S(V.dbl)]; };
  eq(['direct', 'inverse', 'square', 'invsq'].map(row), [['6', '24', 24, '2'], ['24', '6', 6, '1/2'], ['3', '48', 48, '4'], ['48', '3', 3, '1/4']], 'through (2, 12)');
  eq([S(MR.variation('inverse', Q(1, 2), 3).k), S(MR.variation('direct', -3, Q(1, 2)).k)], ['3/2', '-1/6'], 'fractions and negatives');
  eq(Object.keys(MR.VARIATION), ['direct', 'inverse', 'square', 'invsq'], 'the four kinds');
});

test('inequalities: critical values, test values, sign-chart solution sets', () => {
  const sol = (N, D, rel) => MR.ineqSetStr(MR.solveIneq(N, D, rel));
  eq(sol([-6, -1, 1], [1], '>'), '(−∞, −2) ∪ (3, ∞)', 'x² − x − 6 > 0');
  eq([sol([0, 0, 1], [1], '≤'), sol([0, 0, 1], [1], '<'), sol([0, 0, 1], [1], '≥')], ['{0}', '∅', '(−∞, ∞)'], 'x² vs 0: touching zero, a single point, empty, everything');
  eq([sol([5, 2, 1], [1], '>'), sol([5, 2, 1], [1], '<')], ['(−∞, ∞)', '∅'], 'no real zeros');
  eq(sol([4, 0, -5, 0, 1], [1], '<'), '(−2, −1) ∪ (1, 2)', 'quartic');
  eq(sol([0, -2, 1, 1], [1], '≥'), '[−2, 0] ∪ [1, ∞)', 'cubic, closed ends, +∞ end');
  eq(sol([-2, 0, 1], [1], '≤'), '[−1.414, 1.414]', 'irrational zeros shown as decimals');
  eq(sol([-4, 1], [1, 1], '<'), '(−1, 4)', '(x − 4)/(x + 1) < 0');
  eq(sol([2, 1], [-3, 1], '≥'), '(−∞, −2] ∪ (3, ∞)', 'denominator zero stays open even with ≥');
  eq(sol([1, 1], [4, -4, 1], '>'), '(−1, 2) ∪ (2, ∞)', 'even-multiplicity denominator zero: no sign change, still excluded');
  eq(sol([-1, 1], [-1, 1], '≥'), '(−∞, 1) ∪ (1, ∞)', 'common zero of N and D is excluded');
  const T = MR.solveIneq([0, 0, 1], [1], '≤');
  eq(T.crit.map(c => [c.x, c.m, c.out, c.inSet]), [[0, 2, false, true]], 'crit with multiplicity and inSet'); eq(T.ivs.map(i => [S(i.t), i.s, i.inSet]), [['-1', 1, false], ['1', 1, false]], 'test values and signs');
  eq(MR.criticalValues(Poly([-1, 1]), Poly([-1, 1])).map(c => [c.x, c.out]), [[1, true]], 'a shared zero is listed once, as excluded'); eq(MR.criticalValues(Poly([1]), Poly([1])), [], 'constant: none');
  eq([MR.testValue(null, null), MR.testValue(null, { x: -2.5 }), MR.testValue({ x: 3 }, null), MR.testValue({ x: -1 }, { x: 4 }), MR.testValue({ x: 2 }, { x: 5 }),
    MR.testValue({ x: 0.5, q: Q(1, 2) }, { x: 1, q: Q(1) }), MR.testValue({ x: 1.4 }, { x: 1.7 })].map(S), ['0', '-3', '4', '0', '4', '3/4', '31/20'], 'friendly test values');
  eq([MR.INEQ['≥'], MR.INEQ_FLIP['<']], [{ s: 1, eq: true }, '>'], 'relation table');
});

test('factored form with integer linear factors', () => {
  eq([[-3, 5, 2], [5, -1], [0, 0, 0, 1], [4, -4, 1], [1, 0, 1], [0, 0, 2], [-2, 0, 1], [3], [0, -1, 0, 1], [-2, 1, 0, -1, 1], [1, 1]].map(c => MR.factorIntStr(c)),
    ['(x + 3)(2x − 1)', '−(x − 5)', 'x³', '(x − 2)²', 'x² + 1', '2x²', 'x² − 2', '3', 'x(x + 1)(x − 1)', 'x⁴ − x³ + x − 2', 'x + 1'], 'text');
  eq([MR.factorIntStr([0, 0, 1], true), MR.factorIntStr([1, -2], true)], ['<i>x</i><sup>2</sup>', '−(2<i>x</i> − 1)'], 'html');
});

test('vertex form and shifted terms', () => {
  const v = MR.vertexForm(2, -8, 3); eq([v.a, v.m, v.q, v.h, v.k].map(S), ['2', '-2', '4', '2', '-5'], '2x² − 8x + 3 = 2(x − 2)² − 5');
  const w = MR.vertexForm(-1, 3, 0); eq([w.h, w.k].map(S), ['3/2', '9/4'], 'fractional vertex');
  for (const [a, b, c] of [[1, 0, 0], [3, 6, -1], [Q(1, 2), -1, 4], [-2, 5, 7]]) { const V = MR.vertexForm(a, b, c); for (const x of [-2, 0, Q(1, 3), 5]) eq(S(Q.add(Q.mul(V.a, Q.pow(Q.sub(x, V.h), 2)), V.k)), S(Poly.eval(Poly([c, b, a]), x)), `a(x − h)² + k = ax² + bx + c at ${x}`); }
  eq([MR.vertexFormStr(Q(2), Q(2), Q(-5)), MR.vertexFormStr(Q(1), Q(0), Q(0)), MR.vertexFormStr(Q(-1), Q(-3), Q(1, 2)), MR.vertexFormStr(Q(1, 2), Q(1), Q(0)), MR.vertexFormStr(Q(-1, 2), Q(1), Q(0))],
    ['2(x − 2)² − 5', 'x²', '−(x + 3)² + 1/2', '(1/2)(x − 1)²', '−(1/2)(x − 1)²'], 'text');
  ok(MR.vertexFormStr(Q(1, 2), Q(-1), Q(3), { html: true }).includes('<span class="c1"><span class="m">1</span></span>)<sup>2</sup>'), 'html colours h');
  eq([MR.shiftStr('y', -2), MR.shiftStr('x', Q(1, 2), true), MR.shiftStr('x', 0), MR.sqShiftStr('x', 2), MR.sqShiftStr('y', 0, true), MR.sqShiftStr('x', Q(-3, 2))],
    ['(y + 2)', '(<i>x</i> − 1/2)', 'x', '(x − 2)²', '<i>y</i><sup>2</sup>', '(x + 3/2)²'], 'shiftStr, sqShiftStr');
});

test('conics: standard-form text, ± values, general form', () => {
  const std = o => MR.conicStdForm(MR.conic(o));
  eq([std({ A: 1, C: 1, D: -4, E: 6, F: -12 }), std({ A: 4, C: 9, D: -16, E: 18, F: -11 }), std({ A: 9, C: -4, D: -18, E: -16, F: -43 }), std({ A: -9, C: 4, D: 18, E: 16, F: -29 }),
    std({ A: 1, D: -4, E: -8, F: 12 }), std({ C: 1, D: -2, E: 4, F: 5 }), std({ A: 1, C: 1, F: 1 })],
    ['(x − 2)² + (y + 3)² = 25', '(x − 2)²/9 + (y + 1)²/4 = 1', '(x − 1)²/4 − (y + 2)²/9 = 1', '(y + 2)²/9 − (x − 1)²/4 = 1', '(x − 2)² = 8(y − 1)', '(y + 2)² = 2(x − 1/2)', ''],
    'circle, ellipse, both hyperbolas, both parabolas, empty set');
  eq(MR.conicStdForm(MR.conic({ A: 4, C: 9, F: -36 }), true), '<span class="fr"><span><i>x</i><sup>2</sup></span><span>9</span></span> + <span class="fr"><span><i>y</i><sup>2</sup></span><span>4</span></span> = 1', 'html, centred at the origin');
  eq([MR.sqrtQStr(Q(25, 4)), MR.sqrtQStr(8), MR.pmRootStr(0, 5), MR.pmRootStr(-2, 9)], ['5/2', '2√2', '±√5', '−2 ± 3'], '√q and h ± √q');
  eq([MR.pmPairStr(2, -1, 25, true), MR.pmPairStr(0, 3, 4, true), MR.pmPairStr(1, 0, 4, false), MR.pmPairStr(1, 2, 3, false)], ['(−3, −1), (7, −1)', '(±2, 3)', '(1, ±2)', '(1, 2 ± √3)'], 'pairs of points');
  eq([MR.generalFormH({ A: 1, C: -4, D: Q(1, 2), E: 0, F: -1 }), MR.generalFormH({}), MR.generalFormH({ A: -1, C: 1, F: 0 })],
    ['<i>x</i><sup>2</sup> − 4<i>y</i><sup>2</sup> + 1/2<i>x</i> − 1 = 0', '0 = 0', '−<i>x</i><sup>2</sup> + <i>y</i><sup>2</sup> = 0'], 'general form');
});

test('systems: a conic with a line or a second conic', () => {
  const c1 = { A: Q(1), C: Q(1), E: Q(0), F: Q(-25) }, line = (m, b) => ({ kind: 'line', m: Q(m), b: Q(b) });
  const brief = o => [o.kind, o.pts.map(p => `(${p.xt}, ${p.yt})`).join(' '), o.tangent, o.complex];
  eq(brief(MR.conicSystem(c1, line(1, 1))), ['points', '(−4, −3) (3, 4)', false, false], 'circle and secant line, exact');
  eq(brief(MR.conicSystem(c1, line(0, 5))), ['points', '(0, 5)', true, false], 'tangent line: double root');
  eq(brief(MR.conicSystem(c1, line(0, 6))), ['none', '', false, true], 'line misses: negative discriminant');
  const irr = MR.conicSystem(c1, line(1, 0)); eq(brief(irr), ['points', '(−3.54, −3.54) (3.54, 3.54)', false, false], 'irrational: decimals'); ok(!irr.pts[0].exact, 'not exact'); near(irr.pts[1].x, Math.sqrt(12.5), 'x = √12.5');
  eq(brief(MR.conicSystem({ A: Q(1), C: Q(0), E: Q(-1), F: Q(0) }, line(2, -1))), ['points', '(1, 1)', true, false], 'parabola and its tangent');
  eq(brief(MR.conicSystem(c1, { A: Q(1), C: Q(-1), E: Q(0), F: Q(-7) })), ['points', '(−4, −3) (4, −3) (−4, 3) (4, 3)', false, false], 'circle and hyperbola: four points');
  eq(brief(MR.conicSystem(c1, { A: Q(1), C: Q(1), E: Q(0), F: Q(-9) })), ['none', '', false, false], 'concentric circles: inconsistent');
  eq(brief(MR.conicSystem(c1, { A: Q(2), C: Q(2), E: Q(0), F: Q(-50) })), ['infinite', '', false, false], 'the same circle twice: dependent');
  eq(brief(MR.conicSystem(c1, { A: Q(1), C: Q(0), E: Q(-1), F: Q(-5) })), ['points', '(0, −5) (−3, 4) (3, 4)', true, false], 'circle and parabola: touching at the bottom');
  const rej = MR.conicSystem({ A: Q(1), C: Q(0), E: Q(-1), F: Q(0) }, { A: Q(1), C: Q(0), E: Q(1), F: Q(2) });
  eq([rej.kind, rej.rejected], ['none', [{ y: '−1', X: '−1' }]], 'y = x², y = −x² − 2: y = −1 needs x² = −1, rejected');
  eq(MR.conicSystem(c1, line(1, 1)).red.v, 'x', 'reduced to an equation in x');
});

test('linear systems: unique, inconsistent, dependent; the 3 × 3 elimination plan', () => {
  const L = r => { const o = MR.linSolve(r); return [o.kind, o.x ? o.x.map(S) : null]; };
  eq(L([[2, 3, 8], [1, -1, -1]]), ['unique', ['1', '2']], '2 × 2'); eq(L([[0, 1, 2], [1, 0, 3]]), ['unique', ['3', '2']], 'needs a row swap');
  eq(L([[1, 2, 3], [2, 4, 6]]), ['infinite', null], '2 × 2 dependent'); eq(L([[1, 2, 3], [2, 4, 7]]), ['none', null], '2 × 2 inconsistent (parallel lines)');
  eq(L([[Q(1, 2), Q(1, 3), 1], [1, -1, Q(1, 6)]]), ['unique', ['19/15', '11/10']], 'rational coefficients');
  eq(L([[1, 1, 1, 6], [2, -1, 1, 3], [1, 2, -1, 2]]), ['unique', ['1', '2', '3']], '3 × 3');
  eq(L([[1, 1, 1, 6], [2, 2, 2, 12], [1, -1, 0, 0]]), ['infinite', null], '3 × 3 dependent'); eq(L([[1, 1, 1, 6], [1, 1, 1, 7], [1, -1, 0, 0]]), ['none', null], '3 × 3 inconsistent');
  eq([L([[0, 0, 0], [0, 0, 0]]), L([[0, 0, 1], [0, 0, 0]]), L([[3, 7]])], [['infinite', null], ['none', null], ['unique', ['7/3']]], 'degenerate: 0 = 0, 0 = 1, one equation');
  eq(MR.linSolve([[1, 1, 1, 6], [2, 2, 2, 12], [1, -1, 0, 0]]).rank, 2, 'rank');
  eq(MR.elimStep([1, 1, 1, 6], [2, -1, 1, 3], 0), { p: 2, q: -1, g: 1, r: [0, 3, 1, 9] }, 'remove x');
  eq(MR.elimStep([2, 4, 6, 8], [0, 1, 1, 1], 0), { p: 0, q: 1, g: 1, r: [0, 1, 1, 1] }, 'already without x');
  eq(MR.elimStep([0, 3, 1, 9], [0, -3, 2, 0], 1), { p: 1, q: 1, g: 3, r: [0, 0, 1, 3] }, 'common factor divided out');
  const e = MR.elim3([[1, 1, 1, 6], [2, -1, 1, 3], [1, 2, -1, 2]]); eq([e.x, e.y, e.z].map(S), ['1', '2', '3'], 'elim3 solution'); eq([e.s4.r, e.s5.r, e.s6.r], [[0, 3, 1, 9], [0, 1, -2, -4], [0, 0, 1, 3]], 'elim3 steps');
  eq([MR.elim3([[0, 1, 1, 1], [1, 1, 1, 1], [1, 0, 0, 1]]), MR.elim3([[1, 1, 1, 6], [2, 2, 2, 12], [1, -1, 0, 0]]), MR.elim3([[1, 1, 1, 6], [1, 1, 1, 7], [1, -1, 0, 0]])], [null, null, null], 'plan fails: a₁ = 0, dependent, inconsistent');
});

test('equations in quadratic form (back-substitution), radical fractions, scientific text', () => {
  const xs = (k, r, h) => { const o = MR.backSub(k, r, h); return [o.xs.map(x => x.t), o.rej]; };
  eq([xs('sq', 4), xs('sq', Q(1, 2)), xs('sq', 0), xs('sq', -1)], [[['−2', '2'], null], [['−√2/2', '√2/2'], null], [['0'], null], [[], 'a square is never negative']], 'u = x²');
  eq([xs('lin', 3, -2), xs('sqrt', Q(3, 2)), xs('cbrt', -2), xs('inv', Q(-2, 3)), xs('inv', 0)], [[['1'], null], [['9/4'], null], [['−8'], null], [['−3/2'], null], [[], '1/x is never 0']], 'other substitutions');
  const s = MR.backSub('sqrt', -2); eq([s.xs, s.rej, S(s.cand)], [[], 'a principal square root is never negative', '4'], '√x = −2: extraneous candidate 4');
  let threw = false; try { MR.backSub('log', 1); } catch (err) { threw = true; } ok(threw, 'unknown kind throws');
  eq([MR.radFrac(Q(1, 2), 2).t, MR.radFrac(Q(3), 5).t, MR.radFrac(Q(2, 3), 1).t, MR.radFrac(Q(3, 4), 6).t], ['√2/2', '3√5', '2/3', '3√6/4'], 'radFrac text'); ok(MR.radFrac(Q(1, 2), 2).h.includes('class="fr"'), 'radFrac html');
  eq([3162277.66, 31.62, 1e14, 0, -0.00012, 123456, 0.001, -2.5e-7, 9.996e8].map(v => MR.sci(v)), ['3.16 × 10⁶', '31.6', '10¹⁴', '0', '−1.2 × 10⁻⁴', '123,000', '0.001', '−2.5 × 10⁻⁷', '10⁹'], 'sci');
});

test('exponentials and logs: e, exact log points and drills, equations, interest', () => {
  near(MR.compoundE(1), 2, 'n = 1'); near(MR.compoundE(12), Math.pow(13 / 12, 12), 'n = 12'); near(MR.compoundE(1e6), 2.718280469, 'n = 10⁶ (stable)', 1e-9);
  eq([MR.eDigits(2.7182), MR.eDigits(2), MR.eDigits(3), MR.eDigits(Math.E)], [{ text: '2.718200000', chars: 6, decimals: 4 }, { text: '2.000000000', chars: 2, decimals: 0 }, { text: '3.000000000', chars: 0, decimals: 0 }, { text: '2.718281828', chars: 11, decimals: 9 }], 'eDigits');
  const pts = (b, lo, hi) => MR.logPoints(Q(b), lo, hi).map(o => S(o.x) + ':' + S(o.y));
  eq(pts(2, 0.1, 10), ['1/8:-3', '1/4:-2', '1/2:-1', '1:0', '2:1', '4:2', '8:3'], 'base 2'); eq(pts(4, 0.2, 5), ['1/4:-1', '1/2:-1/2', '1:0', '4:1', '2:1/2'], 'base 4 adds half powers');
  eq(pts(Q(1, 2), 1, 2), ['2:-1', '1:0'], 'base 1/2'); eq(pts(10, 2, 9), [], 'no exact point in the window');
  const LC = MR.logCases(); ok(LC.length > 20 && LC.every(o => o.b <= 1000 && o.q !== 0 && o.q !== o.p && Q.eq(o.y, Q(o.q, o.p)) && Q.eq(MR.logExact(o.b, o.x), o.y)), 'drill cases are exact and in range');
  const rq = (a, b) => { const o = MR.radicalEq(a, b); return [o.D, o.cands.map(c => [c.t, c.ok]), o.sol.length]; };
  eq(rq(7, -1), [33, [['(3 − √33)/2', false], ['(3 + √33)/2', true]], 1], '√(x + 7) = x − 1: irrational, one extraneous');
  eq(rq(4, -2), [25, [['0', false], ['5', true]], 1], '√(x + 4) = x − 2: 0 is extraneous'); eq(rq(2, 0), [9, [['−1', false], ['2', true]], 1], '√(x + 2) = x');
  eq(rq(0, 1), [-3, [], 0], 'no real candidates');
  eq([MR.logSumEq(2, 0, 2, 3), MR.logSumEq(10, 0, 3, 1)], [{ V: 8, D: 36, s: 2, r: -4, lo: 0 }, { V: 10, D: 49, s: 2, r: -5, lo: 0 }], 'log x + log(x + p) = n'); eq(MR.logSumEq(2, 0, 1, 1), { V: 2, D: 9, s: 1, r: -2, lo: 0 }, 'x(x + 1) = 2'); eq(MR.logSumEq(2, 0, 1, 2), null, 'x(x + 1) = 4: roots not integers');
  eq([MR.sameBaseX(2, 1, 3, 0), MR.sameBaseX(1, 0, 0, 0, 3), MR.sameBaseX(2, 1, 2, 5)].map(v => v && S(v)), ['2', '3', null], '4^(x+1) = 8^x; 2^x = 2³; equal exponent slopes: none');
  eq(MR.quadExpRoots(2, 8, -3), { keep: [{ u: 8, x: 3 }], drop: [-3] }, 'bˣ = −3 dropped'); near(MR.quadExpRoots(3, 9, 1).keep[1].x, 2, '3ˣ = 9'); eq(MR.quadExpRoots(3, 9, 1).keep[0], { u: 1, x: 0 }, '3ˣ = 1');
  near(MR.apy(0.05, 12), Math.pow(1 + 0.05 / 12, 12) - 1, 'APY monthly'); near(MR.apy(0.05, Infinity), Math.exp(0.05) - 1, 'APY continuous'); near(MR.apy(0.05, 1), 0.05, 'APY yearly');
  near(MR.doublingTime(0.05, Infinity), Math.LN2 / 0.05, 'doubling, continuous'); near(MR.doublingTime(0.05, 1), Math.log(2) / Math.log(1.05), 'doubling, yearly');
  near(MR.periodBalance(1000, 0.05, 1, 1.5), 1050, 'paid yearly: 1.5 years earns one payment'); near(MR.periodBalance(1000, 0.05, 4, 1), 1000 * 1.0125 ** 4, 'quarterly, one year', 1e-6);
  near(MR.periodBalance(1000, 0.12, 12, 0.999), 1000 * 1.01 ** 11, 'just before the 12th payment', 1e-6); near(MR.periodBalance(1000, 0.05, Infinity, 2), 1000 * Math.exp(0.1), 'continuous', 1e-6);
});

test('sequences and series: solve for n, repeating decimals, exact sums, Pascal paths, monomials', () => {
  const a = (...x) => { const o = MR.arithSolveN(...x); return [o.roots, o.n, o.rejected]; };
  eq(a(3, 2, 120), [[-12, 10], 10, [-12]], 'n(n + 2) = 120'); eq(a(20, -2, 110, { positive: true }), [[10, 11], 10, [11]], 'decreasing terms: n = 11 reaches 0, rejected');
  eq(a(20, -2, 110), [[10, 11], 10, []], 'both counts without the positivity rule'); eq(a(5, 0, 35), [[7], 7, []], 'd = 0: linear'); eq(a(5, 0, 33), [[6.6], null, [6.6]], 'not a whole number');
  eq(a(1, 1, -5), [[], null, []], 'negative discriminant'); eq(a(0, 0, 0), [[], null, []], 'all zero: no equation in n');
  eq(MR.arithSolveN(3, 2, 120).D, 1936, 'discriminant');
  const r = (...x) => { const o = MR.repDecimal(...x); return [o.head, o.a1, o.r, o.tail, o.value, o.raw].map(S); };
  eq(r(0, '', '36'), ['0', '9/25', '1/100', '4/11', '4/11', '4/11'], '0.3636…'); eq(r(0, '1', '6'), ['1/10', '3/50', '1/10', '1/15', '1/6', '2/3'], '0.1666…');
  eq(r(2, '', '9')[4], '3', '2.999… = 3'); eq(r(1, '25', '142857')[4], '219/175', '1.25142857…'); eq(r(0, '', '0')[4], '0', '0.000…');
  eq([MR.geomExact(3, 2, 5), MR.geomExact(Q(1, 2), Q(1, 2), 10), MR.geomExact(1, -1, 7), MR.geomExact(1, 1, 4)].map(S), ['93', '1023/1024', '1', '4'], 'exact partial sums (r = −1, r = 1)');
  eq([MR.geomExact(1, 10, 20), MR.geomExact(3, Q(2, 3), 40)], [null, null], 'too big for safe integers');
  eq([0, 1, 2, 3, 4, 5].map(m => MR.pascalPath(4, 2, m).join('')), ['aabb', 'abab', 'abba', 'baab', 'baba', 'bbaa'], 'all C(4, 2) paths in order');
  eq([MR.pascalPath(3, 0, 0).join(''), MR.pascalPath(3, 3, 0).join(''), MR.pascalPath(0, 0, 0)], ['aaa', 'bbb', []], 'edges of the triangle, the apex');
  eq([MR.monoStr(-160, [['a', 3], ['b', 3]]), MR.monoStr(1, [['x', 1]], false), MR.monoStr(-1, [['x', 2], ['y', 0]], false), MR.monoStr(7, [['x', 0]]), MR.monoStr(-4, []), MR.monoStr(12, [['x', 10]], false)],
    ['−160<i>a</i>³<i>b</i>³', 'x', '−x²', '7', '−4', '12x¹⁰'], 'monomials');
});
