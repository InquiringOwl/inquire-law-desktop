// Logic tests for the CS lab kit's rules (web/kits/subjects/cs.js → CSRules), on real traces from web/cs-src/_demo-kit.py.
const ctx = load('tests/fixtures/_demo-kit.js', ...kits(), 'web/kits/subjects/cs.js');
const CR = ctx.CSRules, TR = ctx.CSTraces;
const last = T => T.steps.length - 1;

test('highlighting splits Python into tokens', () => {
  const t = CR.tokens('for i in range(3):  # count');
  eq(t.filter(x => x.t === 'kw').map(x => x.s), ['for', 'in'], 'keywords');
  eq(t.filter(x => x.t === 'bi').map(x => x.s), ['range'], 'builtins'); eq(t.filter(x => x.t === 'num').map(x => x.s), ['3'], 'numbers');
  eq(t[t.length - 1], { t: 'com', s: '# count' }, 'comment last');
  eq(CR.tokens('s = "a # not a comment"').filter(x => x.t === 'str').map(x => x.s), ['"a # not a comment"'], '# inside a string');
  eq(CR.tokens("f'x={x}'")[0].t, 'str', 'f-string'); eq(CR.tokens('x').map(x => x.s).join(''), 'x', 'round trip');
});

test('swap: input echo, final values, output', () => {
  const T = TR['_demo-kit/swap'];
  eq(T.out, 'a? 3\nb? 5\n5 3\n', 'terminal output'); eq(T.steps[last(T)].ev, 'end', 'ends with end step');
  eq(CR.watch(T, 'a'), [undefined, '3', '3', '5', '5'], 'a over time'); eq(CR.watch(T, 'b').slice(-1), ['3'], 'b at end');
  eq(CR.outAt(T, 0), '', 'no output before the first line runs');
  eq([...CR.changed(T, 3)].sort(), ['0:a', '0:b'], 'tuple swap changes both');
});

test('alias: two names, one list; a copy is a new list', () => {
  const T = TR['_demo-kit/alias'], s = T.steps[last(T)], v = s.f[0].vars;
  eq(v.xs, v.ys, 'xs and ys hold the same reference'); ok(v.zs[1] !== v.xs[1], 'slice copy is a different object');
  eq(CR.show(v.xs, s.h), '[1, 2, 3]', 'xs shows the append made through ys'); eq(CR.show(v.zs, s.h), '[1, 2, 3, 4]', 'zs');
  eq(CR.nums(T, last(T), 'zs'), [1, 2, 3, 4], 'as numbers for bars');
});

test('fact: call stack grows and unwinds, return values', () => {
  const T = TR['_demo-kit/fact'];
  eq(Math.max(...T.steps.map(s => s.f.length)), 4, 'global + three frames for fact(3)');
  const rets = T.steps.filter(s => s.ev === 'return').map(s => CR.show(s.r, s.h)); eq(rets, ['1', '2', '6'], 'returns 1, 2, 6');
  ok(/returns 6/.test(CR.evText(T, T.steps.findIndex(s => s.ev === 'return' && CR.show(s.r, s.h) === '6'))), 'event text');
  eq(T.out, '6\n', 'prints 6');
});

test('objects show their attributes', () => {
  const T = TR['_demo-kit/point'], s = T.steps[last(T)];
  eq(CR.show(s.f[0].vars.p, s.h), 'Point(x=5, y=2)', 'object display'); eq(CR.show(s.f[0].vars.Point, s.h), 'class Point', 'class');
});

test('display of tuples, sets, dicts and cycles', () => {
  const h = { a: { t: 'tuple', v: [['v', '1']] }, b: { t: 'set', v: [] }, c: { t: 'dict', v: [[['v', "'k'"], ['v', '2']]] }, d: { t: 'list', v: [['r', 'd']] } };
  eq(CR.show(['r', 'a'], h), '(1,)', 'one-tuple'); eq(CR.show(['r', 'b'], h), 'set()', 'empty set');
  eq(CR.show(['r', 'c'], h), "{'k': 2}", 'dict'); eq(CR.show(['r', 'd'], h), '[[...]]', 'cycle');
});

test('bits: bases, two\'s complement, UTF-8', () => {
  eq(CR.toBase(13, 2, 8), '00001101', '13'); eq(CR.toBase(255, 16), 'FF', 'hex'); eq(CR.fromBase('1010', 2), 10, 'from binary'); eq(CR.fromBase('ff', 16), 255, 'from hex');
  eq(CR.twos(-3, 8), '11111101', '-3'); eq(CR.twos(127, 8), '01111111', 'max'); eq(CR.twos(-128, 8), '10000000', 'min');
  for (let n = -128; n <= 127; n++) if (CR.fromTwos(CR.twos(n, 8)) !== n) throw new Error('round trip ' + n);
  let threw = false; try { CR.twos(128, 8); } catch (e) { threw = true; } ok(threw, '128 does not fit in 8 bits');
  eq(CR.utf8('A'), [65], 'ASCII'); eq(CR.utf8('é'), [0xC3, 0xA9], 'two bytes'); eq(CR.utf8('€'), [0xE2, 0x82, 0xAC], 'three bytes'); eq(CR.utf8('😀').length, 4, 'four bytes');
});

test('seeded shuffle is a permutation and repeatable', () => {
  const a = CR.shuffle([1, 2, 3, 4, 5], 7); eq(a.slice().sort(), [1, 2, 3, 4, 5], 'same items'); eq(CR.shuffle([1, 2, 3, 4, 5], 7), a, 'same seed, same order');
});

test('hits counts loop passes up to a step', () => {
  const T = TR['_demo-kit/file'], L = T.steps.length - 1;
  eq(CR.hits(T, 0, 4), 0, 'before the loop'); eq(CR.hits(T, L, 4), 2, 'two lines in the file, two passes');
  eq(CR.hits(T, L, 1), 1, 'a straight-line statement runs once');
});

test('@heap draws plain values as objects', () => {
  const h = { a: { t: 'val', c: 'int', v: '5' } };
  eq(CR.show(['r', 'a'], h), '5', 'val shows its repr');
});
