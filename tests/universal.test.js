// Logic tests for the universal and categorical kits (web/kits/universal, web/kits/categorical): number parsing and
// scrubbing (k.vars), drag constraints (k.drag), label placement, quiz controller, step reveal.
const ctx = load(...kits());
const R = ctx.LabKit.rules, PR = ctx.PlaneRules, LK = ctx.LabKit;
const near = (a, b, what, tol = 1e-9) => ok(Math.abs(a - b) < tol, `${what}: got ${a}, want ${b}`);

test('parseNum: integers, decimals, signs, fractions, mixed numbers', () => {
  eq(R.parseNum('3'), 3, 'int'); eq(R.parseNum(' -2.5 '), -2.5, 'decimal'); eq(R.parseNum('−4'), -4, 'U+2212 minus'); eq(R.parseNum('+7'), 7, 'plus');
  eq(R.parseNum('3/4'), 0.75, 'fraction'); eq(R.parseNum('-5/2'), -2.5, 'neg fraction'); eq(R.parseNum('1 1/2'), 1.5, 'mixed'); eq(R.parseNum('.5'), 0.5, 'leading dot');
  eq(R.parseNum('1,000'), 1000, 'thousands comma'); eq(R.parseNum('25%'), 0.25, 'percent'); eq(R.parseNum('1e-3'), 0.001, 'exponent');
});
test('parseNum: π and roots', () => {
  near(R.parseNum('π'), Math.PI, 'π'); near(R.parseNum('2π'), 2 * Math.PI, '2π'); near(R.parseNum('pi/3'), Math.PI / 3, 'pi/3'); near(R.parseNum('-3π/4'), -3 * Math.PI / 4, '−3π/4');
  near(R.parseNum('√2'), Math.SQRT2, '√2'); near(R.parseNum('3√2'), 3 * Math.SQRT2, '3√2'); near(R.parseNum('sqrt 3 / 2'), Math.sqrt(3) / 2, 'sqrt 3 / 2'); near(R.parseNum('0.5π'), Math.PI / 2, '0.5π');
});
test('parseNum: rejects junk and division by zero', () => {
  ['', 'abc', '3/0', '1/2/3', '--2', '2x', '.', 'π/0', null].forEach(s => eq(R.parseNum(s), null, JSON.stringify(s)));
});
test('snap, decimals, clamp, numText', () => {
  eq(R.snap(0.1 + 0.2, 0.1), 0.3, 'float dust'); eq(R.snap(2.37, 0.25), 2.25, 'quarter'); eq(R.snap(-1.6, 1), -2, 'negative'); eq(R.snap(7, 0), 7, 'no step');
  eq(R.decimals(0.25), 2, '0.25'); eq(R.decimals(1), 0, '1'); eq(R.decimals(0.1), 1, '0.1'); eq(R.clamp(5, 0, 3), 3, 'clamp hi'); eq(R.clamp(-5, 0, 3), 0, 'clamp lo');
  eq(R.numText(-0.5), '−0.5', 'minus sign'); eq(R.numText(-0.00001, 3), '0', 'negative zero'); eq(R.numText(1 / 3, 3), '0.333', 'rounding'); eq(R.numText(2), '2', 'int');
});
test('scrubValue: steps per pixel, shift-sized steps, bounds', () => {
  eq(R.scrubValue(2, 0, { step: 1 }), 2, 'no move'); eq(R.scrubValue(2, 12, { step: 1, px: 6 }), 4, '12 px = 2 steps'); eq(R.scrubValue(2, -14, { step: 0.5, px: 6 }), 1, 'left, half steps (−2.33 → −2)');
  eq(R.scrubValue(2, 600, { step: 1, max: 10 }), 10, 'clamped high'); eq(R.scrubValue(2, -600, { step: 1, min: -3 }), -3, 'clamped low'); eq(R.scrubValue(0.1, 6, { step: 0.1 }), 0.2, 'no float dust');
});
test('shuffle: same items, repeatable with a seed', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8]; const s1 = R.shuffle(a, 42), s2 = R.shuffle(a, 42);
  eq(s1, s2, 'seeded repeat'); eq(s1.slice().sort(), a, 'same items'); eq(a, [1, 2, 3, 4, 5, 6, 7, 8], 'input untouched');
});
test('dragTarget: free point snaps and stays in its box', () => {
  const win = [-10, 10, -10, 10];
  eq(PR.dragTarget({ x: 0, y: 0, snap: 0.5 }, 1.26, -2.74, win), { x: 1.5, y: -2.5 }, 'snap 0.5');
  eq(PR.dragTarget({ x: 0, y: 0 }, 50, -50, win), { x: 10, y: -10 }, 'window clamp');
  eq(PR.dragTarget({ x: 0, y: 0, clamp: [0, 4, 0, 4] }, -3, 9, win), { x: 0, y: 4 }, 'own clamp');
  eq(PR.dragTarget({ x: 2, y: 3, fixY: true }, 5, 9, win), { x: 5, y: 3 }, 'fixY slides horizontally');
  eq(PR.dragTarget({ x: 2, y: 3, fixX: true, snapY: 1 }, 5, 6.6, win), { x: 2, y: 7 }, 'fixX + snapY');
});
test('dragTarget: a point glued to a curve slides along it', () => {
  const win = [-5, 5, -20, 20], f = x => x * x - 1;
  eq(PR.dragTarget({ x: 0, y: -1, on: f }, 2, 17, win), { x: 2, y: 3 }, 'y follows f(x), pointer y ignored');
  eq(PR.dragTarget({ x: 0, y: -1, on: f, snap: 0.5 }, 1.3, 0, win), { x: 1.5, y: 1.25 }, 'snapped x on the curve');
  eq(PR.dragTarget({ x: 0, y: -1, on: f }, 9, 0, win), { x: 5, y: 24 }, 'x clamped to the window, y may leave it');
  eq(PR.dragTarget({ x: 1, y: 1, on: x => 1 / x }, 0, 0, win), null, 'refuses a pole');
});
test('dragTarget: path projection (circle, segment)', () => {
  const circle = (x, y) => { const r = Math.hypot(x, y) || 1; return { x: 3 * x / r, y: 3 * y / r }; };
  const t = PR.dragTarget({ x: 3, y: 0, path: circle }, 0, 7, [-5, 5, -5, 5]); near(t.x, 0, 'circle x'); near(t.y, 3, 'circle y');
  const s = PR.projectToSegment(5, 5, 0, 0, 4, 0); eq([s.x, s.y, s.t], [4, 0, 1], 'segment end'); const m = PR.projectToSegment(1, 3, 0, 0, 4, 0); eq([m.x, m.y], [1, 0], 'segment middle');
});
test('nearestOnCurve: closest point of a parametric curve', () => {
  const r = PR.nearestOnCurve(t => 2 * Math.cos(t), t => Math.sin(t), 0, 2 * Math.PI, 0, 5);  // ellipse, point above
  near(r.x, 0, 'x', 1e-5); near(r.y, 1, 'y', 1e-5);
  const q = PR.nearestOnCurve(t => t, t => t * t, -3, 3, 0, -1); near(q.x, 0, 'parabola vertex x', 1e-5);
});
test('niceStep, ticks, placeLabels (moved from MathRules, unchanged)', () => {
  eq(PR.niceStep(20), 2, 'span 20'); eq(PR.niceStep(1), 0.1, 'span 1'); eq(PR.ticks(-1, 1, 0.5), [-1, -0.5, 0, 0.5, 1], 'ticks');
  const r = PR.placeLabels([{ x: 50, y: 50, w: 20, h: 10 }, { x: 50, y: 50, w: 20, h: 10 }], { bounds: { x: 0, y: 0, w: 200, h: 200 } });
  ok(r[0].cost < 1 && r[1].cost < 1, 'two labels at one anchor both find clean spots'); ok(r[0].x !== r[1].x || r[0].y !== r[1].y, 'different places');
});
test('quiz controller and step reveal', () => {
  const Qz = LK.quiz({ items: [1, 2, 3], seed: 7, check: (it, v) => it === v, render: () => '' });
  const first = Qz.item; eq(Qz.pick(first).correct, true, 'right answer'); eq(Qz.pick(99).correct, true, 'second pick ignored'); Qz.next();
  eq(Qz.pick(-1).correct, false, 'wrong answer'); eq(Qz.score, { right: 1, tries: 2 }, 'score'); Qz.reset(); eq(Qz.score, { right: 0, tries: 0 }, 'reset');
  eq(LK.reveal(['a', 'b', 'c'], 1), ['a', 'b', null], 'reveal hides later steps');
});

test('InquireDemo: sweep, big and grow storyboards expand to the right frames', () => {
  const D = ctx.InquireDemo;
  const sw = D.frames({ kind: 'dots', slots: 5, lit: 5, sweep: true, big: true });
  eq(sw.length, 7, 'rest frame + 5 numbered frames + the big total'); eq(sw[0].say, 0, 'starts with nothing said'); eq(sw[3].say, 3, 'the 3rd frame says 3');
  eq(sw[6].big, 5, 'the last frame lifts out the total'); eq(sw[6].say, 5, 'the total is the last number said');
  const gr = D.frames({ kind: 'dots', slots: 8, grow: [4, 5, 6] });
  eq(gr.map(f => f.lit), [4, 5, 6], 'grow lists the counts'); ok(gr.every(f => f.next && f.big === null), 'grow always shows the dashed next dot');
  eq(D.frames({ kind: 'dots', slots: 4, lit: 3 }).length, 1, 'a still picture is one frame');
  eq(D.frames({ frames: [{ lit: 2, say: 1 }, { lit: 2, say: 2, big: 2 }] }).map(f => f.big), [null, 2], 'explicit frames pass through');
});
test('InquireDemo range and tens: cells, elision and frames', () => {
  const D = ctx.InquireDemo;
  const c = D.rangeCells({ kind: 'range', from: 14, to: 22 });
  eq(c.length, 9); eq(c[0].v, 14); eq(c[8].n, 9);
  const e = D.rangeCells({ kind: 'range', from: 12, to: 40 });
  eq(e.length, 10); eq(!!e[6].dots, true); eq(e[9].v, 40); eq(e[9].n, 29);
  const r = D.rangeCells({ kind: 'range', from: 5, to: 45, step: 5 }); eq(r.length, 9); eq(r[8].v, 45);
  const f = D.seqFrames({ kind: 'range', from: 14, to: 22, gaps: true });
  eq(f.length, 12); eq(f[10].big, 9); eq(f[11].gaps, true);
  const t = D.seqFrames({ kind: 'tens', n: 47 });
  eq(t.length, 1 + 4 + 7 + 1); eq(t[4].tens, 4); eq(t[t.length - 1].big, 47);
  eq(D.plural('day', 8), 'days'); eq(D.plural('stitch', 2), 'stitches'); eq(D.plural('seat', 1), 'seat');
});
test('InquireDemo.slotStates: lit, said, next and empty slots', () => {
  const D = ctx.InquireDemo;
  eq(D.slotStates({ lit: 3, say: 2, big: null, next: false }, 5).map(x => x.s + x.n), ['on1', 'say2', 'on', 'off', 'off'], 'numbers only up to the one being said');
  eq(D.slotStates({ lit: 3, say: 0, big: null, next: true }, 5).map(x => x.s), ['on', 'on', 'on', 'next', 'off'], 'the dashed dot sits right after the last lit one');
  eq(D.slotStates({ lit: 5, say: 0, big: null, next: true }, 5).map(x => x.s), ['on', 'on', 'on', 'on', 'on'], 'no dashed dot when the row is full');
});
test('InquireDemo line: points, jumps, distance and checks', () => {
  const D = ctx.InquireDemo;
  const j = D.seqFrames({ kind: 'line', from: 0, to: 20, start: 8, jumps: [5, -3] });
  eq(j.length, 1 + 2 + 1, 'start, two hops, the end'); eq(j[2].jumps, 2); eq(j[3].big, 10, '8 + 5 − 3 = 10'); eq(D.lineEnd({ start: 8, jumps: [5, -3] }), 10);
  const d = D.seqFrames({ kind: 'line', from: 0, to: 20, points: [{ v: 7 }, { v: 12 }], show: 'dist' });
  eq(d.map(f => f.pts), [0, 1, 2, 2]); eq(d[3].dist, true); eq(d[3].big, 5, '|7 − 12| = 5');
  eq(D.check({ kind: 'line', from: 0, to: 20, start: 8, jumps: [5, -3], alt: 'A dot hops along a line.' }), [], 'a good line spec');
  ok(D.check({ kind: 'line', from: 0, to: 10, start: 8, jumps: [5], alt: 'A dot hops along a line.' }).some(x => /outside/.test(x)), 'a jump off the line is refused');
});
test('InquireDemo columns: place value, carries and regrouping', () => {
  const D = ctx.InquireDemo;
  const pv = D.seqFrames({ kind: 'columns', n: 2354 }); eq(pv.length, 6, 'empty, 4 places, total'); eq(pv[5].big, 2354);
  const a = D.colPlan({ add: [368, 457] }); eq(a.steps.map(s => s.digit), [5, 2, 8]); eq(a.steps.map(s => s.cout), [1, 1, 0]); eq(a.result, 825);
  const c = D.colPlan({ add: [999, 1] }); eq(c.steps.map(s => s.digit), [0, 0, 0, 1], 'a last carry becomes a new digit'); eq(c.n, 4);
  const s = D.colPlan({ sub: [503, 168] }); eq(s.steps.map(x => x.digit), [5, 3, 3], '503 − 168 = 335'); eq(s.result, 335);
  eq(s.marks[1].map(m => m.v), [9], 'the tens zero becomes 9'); eq(s.marks[2].map(m => m.v), [4], 'the hundreds 5 lends one');
  const f = D.seqFrames({ kind: 'columns', add: [368, 457] }); eq(f.length, 5); eq(f[4].big, 825);
  ok(D.check({ kind: 'columns', sub: [100, 200], alt: 'Column subtraction picture.' }).length > 0, 'a negative difference is refused');
});
test('InquireDemo bar and array: parts, unknowns, rows', () => {
  const D = ctx.InquireDemo;
  eq(D.barParts({ parts: [340, 125] }).total, 465);
  const u = D.barParts({ parts: [340, null], total: 465 }); eq(u.parts, [340, 125]); eq(u.unknown, 1);
  const f = D.seqFrames({ kind: 'bar', parts: [340, null], total: 465 }); eq(f.length, 5, 'empty, 2 parts, brace, reveal'); eq(f[3].big, null); eq(f[4].big, 125);
  eq(D.seqFrames({ kind: 'bar', parts: [3, 4] }).pop().big, 7);
  const r = D.seqFrames({ kind: 'array', rows: 3, cols: 4 }); eq(r.length, 5); eq(r[4].big, 12);
  eq(D.check({ kind: 'bar', parts: [3, null], total: 2, alt: 'A bar model picture.' }).length, 1, 'total must exceed the known parts');
  eq(D.check({ kind: 'nope' }).length, 1); eq(D.check({ kind: 'dots', slots: 5, lit: 5, alt: 'Five dots in a row.' }), []);
});
test('InquireDemo.holdFrame: a task picture waits on the situation, not the answer', () => {
  const D = ctx.InquireDemo;
  eq(D.holdFrame({ kind: 'line', from: 0, to: 20, start: 8, jumps: [5] }), 0, 'jumps: only the start');
  eq(D.holdFrame({ kind: 'line', from: 0, to: 20, points: [{ v: 3 }, { v: 7 }], show: 'dist' }), 2, 'points: both points, no bracket');
  const b = { kind: 'bar', parts: [27, 15, 8] }; eq(D.seqFrames(b)[D.holdFrame(b)].big, null, 'bar: parts shown, total hidden'); eq(D.seqFrames(b)[D.holdFrame(b)].parts, 3);
  const u = { kind: 'bar', parts: [340, null], total: 465 }; const f = D.seqFrames(u)[D.holdFrame(u)]; eq([f.brace, f.reveal, f.big], [true, false, null], 'unknown part: total shown, part still ?');
  eq(D.holdFrame({ kind: 'columns', add: [1, 2] }), 0); eq(D.holdFrame({ kind: 'range', from: 1, to: 5 }), 0);
});
test('InquireDemo fraction: shade part by part, mixed labels, equivalent split', () => {
  const D = ctx.InquireDemo;
  const f = D.seqFrames({ kind: 'fraction', n: 3, d: 4, split: 2 }); eq(f.length, 4 + 1 + 1); eq(f[4].big, '3/4'); eq(f[5].big, '6/8'); eq(f[5].split, true);
  eq(D.fracLabel(11, 4, true), '2 3/4'); eq(D.fracLabel(8, 4, true), '2'); eq(D.fracLabel(3, 4, true), '3/4'); eq(D.fracLabel(11, 4), '11/4');
  eq(D.check({ kind: 'fraction', n: 3, d: 4, alt: 'Three of four parts shaded.' }), []);
  ok(D.check({ kind: 'fraction', n: 30, d: 4, alt: 'Too many wholes to draw.' }).length > 0, 'more than 4 wholes is refused');
  eq(D.holdFrame({ kind: 'fraction', n: 3, d: 4 }), 0);
});
