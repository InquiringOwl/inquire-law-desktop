// Logic tests for the music lab kit's rules (web/kits/subjects/music.js → MusicTheory).
const MT = load(...kits(), 'web/kits/subjects/music.js').MusicTheory;
const N = p => MT.name(p);

test('MIDI numbers and frequencies (A4 = 440 Hz, C4 = middle C = MIDI 60)', () => {
  eq(MT.midi('C4'), 60, 'C4'); eq(MT.midi('A4'), 69, 'A4'); eq(MT.midi('B#3'), 60, 'B#3 = C4'); eq(MT.midi('Cb4'), 59, 'Cb4 = B3'); eq(MT.midi('A0'), 21, 'lowest piano key'); eq(MT.midi('C8'), 108, 'highest piano key');
  eq(+MT.freq('A4').toFixed(6), 440, 'A4'); eq(+MT.freq('C4').toFixed(2), 261.63, 'C4'); eq(+MT.freq('A5').toFixed(6), 880, 'octave doubles'); eq(+MT.freq('A3').toFixed(6), 220, 'octave halves');
});
test('parse and name spellings', () => {
  for (const s of ['C4', 'F♯3', 'B♭5', 'E𝄫2', 'G𝄪6']) eq(N(MT.parse(s)), s, s);
  eq(N('F#3'), 'F♯3', 'ascii #'); eq(N('Bb5'), 'B♭5', 'ascii b'); eq(MT.name('Fx4', { ascii: true }), 'Fx4', 'ascii out');
});
test('enharmonic spellings of every key', () => {
  for (let m = 21; m <= 108; m++) { const sp = MT.spellings(m); ok(sp.length >= 2 || m % 12 === 8, 'at least two spellings for ' + m); for (const p of sp) eq(MT.midi(p), m, 'spelling of ' + m); }
  eq(MT.spellings(61).map(N).slice(0, 2).sort(), ['C♯4', 'D♭4'], 'C#/Db'); eq(N(MT.fromMidi(61)), 'C♯4', 'sharp default'); eq(N(MT.fromMidi(61, -1)), 'D♭4', 'flat preference');
});
test('pitch class and octave equivalence (mod 12)', () => { eq(MT.pc('C4'), 0); eq(MT.pc('C2'), 0); eq(MT.pc('B#3'), 0); eq(MT.pc('Gb4'), 6); eq(MT.pc('F#1'), 6); });
test('intervals: size from letters, quality from half steps', () => {
  const T = [['C4','C4','P1',0],['C4','D4','M2',2],['C4','Eb4','m3',3],['C4','E4','M3',4],['C4','E#4','A3',5],['C4','Fb4','d4',4],['C4','F4','P4',5],['F4','B4','A4',6],['B4','F5','d5',6],['C4','G4','P5',7],['C4','G#4','A5',8],['C4','Ab4','m6',8],['E4','C5','m6',8],['C4','A4','M6',9],['C#4','Bb4','d7',9],['C4','Bb4','m7',10],['C4','B4','M7',11],['C4','C5','P8',12],['C4','D5','M9',14],['C4','E5','M10',16],['C4','G5','P12',19],['D4','F#4','M3',4],['Eb4','G4','M3',4],['G#4','B4','m3',3]];
  for (const [a, b, name, semis] of T) { const iv = MT.interval(a, b); eq(iv.short, name, `${a}–${b}`); eq(iv.semis, semis, `${a}–${b} half steps`); }
  eq(MT.interval('C4', 'E4').long, 'major third'); eq(MT.interval('B3', 'F4').long, 'diminished fifth'); eq(MT.interval('C4', 'C5').long, 'perfect octave');
});
test('transpose up and down round-trips for every interval from every common spelling', () => {
  const ivs = ['P1','m2','M2','m3','M3','P4','A4','d5','P5','m6','M6','m7','M7','P8','M9','P12'];
  for (let l = 0; l < 7; l++) for (const a of [-1, 0, 1]) { const p = { l, a, o: 4 }; for (const iv of ivs) {
    const q = MT.up(p, iv); eq(MT.interval(p, q).short, iv, `${N(p)} up ${iv} = ${N(q)}`); eq(N(MT.down(q, iv)), N(p), `${N(q)} down ${iv}`); } }
  eq(N(MT.up('E4', 'M3')), 'G♯4'); eq(N(MT.up('Bb3', 'P5')), 'F4'); eq(N(MT.down('C4', 'm3')), 'A3');
});
test('interval inversion: sizes sum to 9, qualities swap', () => { eq(MT.invert('M3'), 'm6'); eq(MT.invert('P4'), 'P5'); eq(MT.invert('A4'), 'd5'); eq(MT.invert('m2'), 'M7'); eq(MT.invert('P1'), 'P8'); });
test('scales spelled with one of each letter', () => {
  eq(MT.scale('C4').map(N), ['C4','D4','E4','F4','G4','A4','B4','C5']);
  eq(MT.scale('F#4').map(N), ['F♯4','G♯4','A♯4','B4','C♯5','D♯5','E♯5','F♯5'], 'F# major has E#');
  eq(MT.scale('Gb4').map(N), ['G♭4','A♭4','B♭4','C♭5','D♭5','E♭5','F5','G♭5'], 'Gb major has Cb');
  eq(MT.scale('A3', 'harmonic minor').map(N), ['A3','B3','C4','D4','E4','F4','G♯4','A4']);
  eq(MT.scale('D4', 'dorian').map(N), ['D4','E4','F4','G4','A4','B4','C5','D5']);
  for (const t of ['C4','G4','D4','A4','E4','B4','F#4','C#4','F4','Bb4','Eb4','Ab4','Db4','Gb4','Cb4']) { const s = MT.scale(t); const steps = s.slice(1).map((p, i) => MT.midi(p) - MT.midi(s[i])); eq(steps, [2,2,1,2,2,2,1], t + ' major W W H W W W H'); eq(new Set(s.slice(0, 7).map(p => p.l)).size, 7, t + ' uses each letter once'); }
});
test('key signatures (sharps +, flats −) and the order of accidentals', () => {
  const K = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 };
  for (const [k, n] of Object.entries(K)) eq(MT.keySig(k), n, k + ' major');
  eq(MT.keySig('A', 'minor'), 0); eq(MT.keySig('E', 'minor'), 1); eq(MT.keySig('D', 'minor'), -1); eq(MT.keySig('Bb', 'minor'), -5); eq(MT.keySig('G#', 'minor'), 5);
  eq(MT.sigLetters(3), ['F','C','G']); eq(MT.sigLetters(-4), ['B','E','A','D']);
  for (const [k, n] of Object.entries(K)) { const sc = MT.scale(k + '4'); for (const p of sc) eq(p.a, MT.sigAcc(n, p.l), `${k} major: ${N(p)} matches the signature`); }
});
test('staff positions for each clef (0 = bottom line, 8 = top line)', () => {
  eq(MT.staffPos('E4', 'treble'), 0); eq(MT.staffPos('G4', 'treble'), 2, 'G clef curls round line 2'); eq(MT.staffPos('F5', 'treble'), 8); eq(MT.staffPos('C4', 'treble'), -2, 'middle C on a ledger below treble');
  eq(MT.staffPos('G2', 'bass'), 0); eq(MT.staffPos('F3', 'bass'), 6, 'F clef dots round line 4'); eq(MT.staffPos('A3', 'bass'), 8); eq(MT.staffPos('C4', 'bass'), 10, 'middle C on a ledger above bass');
  eq(MT.staffPos('C4', 'alto'), 4, 'alto: middle line'); eq(MT.staffPos('C4', 'tenor'), 6, 'tenor: fourth line');
  eq(MT.ledgers(-2), [-2]); eq(MT.ledgers(-5), [-2, -4]); eq(MT.ledgers(11), [10]); eq(MT.ledgers(4), []);
  for (const c of ['treble', 'bass', 'alto', 'tenor']) for (let pos = -6; pos <= 14; pos++) eq(MT.staffPos(MT.fromStaffPos(pos, c), c), pos, c + ' round trip ' + pos);
});
test('note values are exact fractions of a whole note; dots add half, then a quarter', () => {
  eq(String(MT.dur('quarter')), '1/4'); eq(String(MT.dur('quarter', 1)), '3/8'); eq(String(MT.dur('half', 2)), '7/8'); eq(String(MT.dur('eighth', 1)), '3/16'); eq(String(MT.dur('whole', 1)), '3/2');
  ok(MT.dur('half').eq(MT.dur('quarter').add(MT.dur('quarter'))), 'half = 2 quarters'); ok(MT.dur('quarter').eq(MT.dur('sixteenth').mul(MT.R(4))), 'quarter = 4 sixteenths');
});
test('meters: simple vs compound, beat unit, grouping', () => {
  const T = { '2/4': ['simple duple', '1/4'], '3/4': ['simple triple', '1/4'], '4/4': ['simple quadruple', '1/4'], '2/2': ['simple duple', '1/2'], '3/8': ['simple triple', '1/8'],
    '6/8': ['compound duple', '3/8'], '9/8': ['compound triple', '3/8'], '12/8': ['compound quadruple', '3/8'], '6/4': ['compound duple', '3/4'], '5/8': ['asymmetric 5 unequal', '1/8'] };
  for (const [s, [nm, beat]] of Object.entries(T)) { const m = MT.meter(s); eq(m.name, nm, s); eq(String(m.beat), beat, s + ' beat'); }
  eq(String(MT.meter('3/4').measure), '3/4'); eq(MT.meter('6/8').division, 3);
});
test('barring: durations fill measures exactly or report the overflow', () => {
  const q = MT.dur('quarter'), h = MT.dur('half'), dq = MT.dur('quarter', 1), e = MT.dur('eighth');
  const b = MT.bar('3/4', [h, q, dq, e, q, q]); eq(b.map(x => x.full), [true, true, false], '3/4 bars'); eq(String(b[2].short), '1/2', 'last bar is a half short');
  const o = MT.bar('2/4', [dq, q]); eq(o[0].full, false); eq(String(o[0].over), '1/8', 'crosses the bar by an eighth');
});
test('harmonic series, cents and nearest note', () => {
  eq(MT.harmonics(110, 4).map(h => h.f), [110, 220, 330, 440]); eq(+MT.cents(2).toFixed(6), 1200); eq(+MT.cents(1.5).toFixed(2), 701.96, 'pure fifth'); eq(+MT.cents(2 ** (7 / 12)).toFixed(6), 700, 'tempered fifth');
  eq(MT.nearest(440).midi, 69); eq(MT.nearest(330).midi, 64, '330 Hz is nearest E4'); eq(+MT.nearest(330).cents.toFixed(2), 1.96, 'a pure fifth above A3 is 2 cents sharp of tempered E4');
});
