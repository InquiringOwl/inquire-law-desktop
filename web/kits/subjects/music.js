/* ============ Subject kit: Music ============
   Two layers, so labs only write what is unique to their topic:
   1. window.MusicTheory (MT): pure, DOM-free rules: pitch spelling, MIDI and frequency, intervals,
      transposition, scales, key signatures, clef positions, exact rhythm values, meters, harmonics.
      Tested in tests/music.test.js (node tools/labtest.js music). Put any new rule a lab needs HERE, with a test.
   2. window.MusicKit.attach(k): drawing and sound on top of the lab kit `k` (web/kits/universal/core.js):
      staff with vector clefs, notes, rests, accidentals, time and key signatures, beams, a piano keyboard,
      and a small Web Audio synth (never autoplays; sound starts only from a button or a key press).
   API summary is in web/WRITER-PACK-MUSIC.md. */
(function(){
const W = window;

/* ---------------- 1. MusicTheory: rules ---------------- */
const LET = "CDEFGAB", NAT = [0, 2, 4, 5, 7, 9, 11];
const ACC_U = { "-2": "𝄫", "-1": "♭", "0": "", "1": "♯", "2": "𝄪" }, ACC_A = { "-2": "bb", "-1": "b", "0": "", "1": "#", "2": "x" };
const mod = (a, n) => ((a % n) + n) % n;

// Exact rationals for rhythm (durations in whole notes).
function R(n, d = 1){ if (d < 0) { n = -n; d = -d; } const g = gcdI(Math.abs(n), d) || 1; return Object.freeze({ n: n / g, d: d / g, add: o => R(n * o.d + o.n * d, d * o.d), sub: o => R(n * o.d - o.n * d, d * o.d), mul: o => R(n * o.n, d * o.d), div: o => R(n * o.d, d * o.n), eq: o => n * o.d === o.n * d, lt: o => n * o.d < o.n * d, val: n / d, toString: () => d / g === 1 ? String(n / g) : `${n / g}/${d / g}` }); }
function gcdI(a, b){ while (b) [a, b] = [b, a % b]; return a; }

function parse(s){
  if (typeof s === "object") return s;
  const m = String(s).trim().match(/^([A-Ga-g])(𝄪|𝄫|♯|♭|♮|##|bb|#|b|x|n)?(-?\d+)?$/);
  if (!m) throw new Error(`MusicTheory.parse: "${s}" is not a pitch like C4, F#3, Bb5`);
  const a = { "𝄪": 2, "x": 2, "##": 2, "♯": 1, "#": 1, "♭": -1, "b": -1, "𝄫": -2, "bb": -2, "♮": 0, "n": 0 }[m[2] || ""] || 0;
  return { l: LET.indexOf(m[1].toUpperCase()), a, o: m[3] === undefined ? 4 : +m[3] };
}
const accSym = (a, ascii) => (ascii ? ACC_A : ACC_U)[a] ?? (a > 0 ? "♯".repeat(a) : "♭".repeat(-a));
const name = (p, o = {}) => { p = parse(p); return LET[p.l] + accSym(p.a, o.ascii) + (o.octave === false ? "" : p.o); };
const midi = p => { p = parse(p); return 12 * (p.o + 1) + NAT[p.l] + p.a; };
const pc = p => mod(midi(p), 12);
const dia = p => { p = parse(p); return p.o * 7 + p.l; };            // diatonic step number (letter + octave)
const freq = (p, a4 = 440) => a4 * Math.pow(2, ((typeof p === "number" ? p : midi(p)) - 69) / 12);
const fromDia = (d, a = 0) => ({ l: mod(d, 7), a, o: Math.floor(d / 7) });
// All reasonable spellings (accidentals −2…+2) of a MIDI note, simplest first.
function spellings(m){ const out = []; for (let l = 0; l < 7; l++) for (const a of [0, 1, -1, 2, -2]) { const base = NAT[l] + a, o = Math.floor((m - base) / 12) - 1; if (12 * (o + 1) + base === m) out.push({ l, a, o }); } return out.sort((x, y) => Math.abs(x.a) - Math.abs(y.a)); }
// Default spelling for a key on the keyboard: naturals, else sharp (flats if prefer < 0).
const fromMidi = (m, prefer = 1) => { const s = spellings(m); return s.find(x => x.a === 0) || s.find(x => Math.sign(x.a) === Math.sign(prefer) && Math.abs(x.a) === 1) || s[0]; };

const SIZE = ["unison", "second", "third", "fourth", "fifth", "sixth", "seventh", "octave", "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "double octave"];
const PERFECT = s => [1, 4, 5].includes(s);
const QLONG = { P: "perfect", M: "major", m: "minor", A: "augmented", d: "diminished", AA: "doubly augmented", dd: "doubly diminished" };
// Interval from p up to q (q must not be below p in letter+octave).
function interval(p, q){
  const size = dia(q) - dia(p) + 1;
  if (size < 1) throw new Error("MusicTheory.interval: second pitch is below the first; pass the lower note first");
  const simple = mod(size - 1, 7) + 1, semis = midi(q) - midi(p);
  const ref = NAT[simple - 1] + 12 * Math.floor((size - 1) / 7), diff = semis - ref;
  const quality = PERFECT(simple) ? ({ 0: "P", 1: "A", "-1": "d", 2: "AA", "-2": "dd" })[diff] : ({ 0: "M", "-1": "m", 1: "A", "-2": "d", 2: "AA", "-3": "dd" })[diff];
  if (!quality) return { size, simple, semis, quality: "?", short: `?${size}`, long: "not a standard interval", compound: size > 8 };
  return { size, simple, semis, quality, short: quality + size, long: `${QLONG[quality]} ${SIZE[size - 1] || size + "th"}`, compound: size > 8 };
}
function ivParse(s){ const m = String(s).match(/^(AA|dd|P|M|m|A|d)(\d+)$/); if (!m) throw new Error(`MusicTheory: "${s}" is not an interval like M3, P5, A4`); return { q: m[1], size: +m[2] }; }
function ivSemis(q, size){ const simple = mod(size - 1, 7) + 1, ref = NAT[simple - 1] + 12 * Math.floor((size - 1) / 7);
  const off = PERFECT(simple) ? { P: 0, A: 1, d: -1, AA: 2, dd: -2 }[q] : { M: 0, m: -1, A: 1, d: -2, AA: 2, dd: -3 }[q];
  if (off === undefined) throw new Error(`MusicTheory: ${q}${size} does not exist (${PERFECT(simple) ? "perfect" : "major/minor"} class)`); return ref + off; }
function up(p, iv){ p = parse(p); const { q, size } = ivParse(iv); const t = fromDia(dia(p) + size - 1); t.a = midi(p) + ivSemis(q, size) - midi({ ...t, a: 0 }); return t; }
function down(p, iv){ p = parse(p); const { q, size } = ivParse(iv); const t = fromDia(dia(p) - size + 1); t.a = midi(p) - ivSemis(q, size) - midi({ ...t, a: 0 }); return t; }
// Interval inversion (simple intervals): sizes sum to 9, M↔m, A↔d, P stays P.
const invert = iv => { const { q, size } = ivParse(iv); const s = mod(size - 1, 7) + 1; return ({ P: "P", M: "m", m: "M", A: "d", d: "A", AA: "dd", dd: "AA" })[q] + (9 - s); };

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], "natural minor": [0, 2, 3, 5, 7, 8, 10], "harmonic minor": [0, 2, 3, 5, 7, 8, 11], "melodic minor": [0, 2, 3, 5, 7, 9, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], locrian: [0, 1, 3, 5, 6, 8, 10]
};
// A seven-note scale spelled with one of each letter, ascending from tonic, plus the octave.
function scale(tonic, kind = "major"){ tonic = parse(tonic); const pat = SCALES[kind]; if (!pat) throw new Error("MusicTheory.scale: unknown kind " + kind);
  const out = pat.map((s, i) => { const t = fromDia(dia(tonic) + i); t.a = midi(tonic) + s - midi({ ...t, a: 0 }); return t; });
  out.push({ ...tonic, o: tonic.o + 1 }); return out; }
const DEGREE = ["tonic", "supertonic", "mediant", "subdominant", "dominant", "submediant", "leading tone"];
// Key signature as signed count: +n sharps, −n flats. Major from the circle of fifths; a minor key shares its relative major's.
const FIFTHS = [0, 2, 4, -1, 1, 3, 5];          // C D E F G A B majors
function keySig(tonic, mode = "major"){ const t = parse(tonic); return FIFTHS[t.l] + 7 * t.a - (mode === "minor" ? 3 : 0); }
const sigLetters = n => n >= 0 ? "FCGDAEB".slice(0, n).split("") : "BEADGCF".slice(0, -n).split("");
// Pitch spelled under a key signature: the letter's accidental from the signature.
const sigAcc = (n, l) => (n > 0 && sigLetters(n).includes(LET[l])) ? 1 : (n < 0 && sigLetters(n).includes(LET[l])) ? -1 : 0;

// Staff positions: 0 = bottom line, 1 = first space, 2 = second line … 8 = top line. Clefs named by their bottom-line pitch.
const CLEFS = { treble: { bottom: "E4", line: 2, pitch: "G4" }, bass: { bottom: "G2", line: 6, pitch: "F3" }, alto: { bottom: "F3", line: 4, pitch: "C4" }, tenor: { bottom: "D3", line: 6, pitch: "C4" } };
const staffPos = (p, clef = "treble") => dia(p) - dia(CLEFS[clef].bottom);
const fromStaffPos = (pos, clef = "treble", a = 0) => fromDia(dia(CLEFS[clef].bottom) + pos, a);
const ledgers = pos => { const out = []; for (let y = -2; y >= pos; y -= 2) out.push(y); for (let y = 10; y <= pos; y += 2) out.push(y); return out; };

// Rhythm. Durations in whole notes (exact).
const DUR = { whole: R(1), half: R(1, 2), quarter: R(1, 4), eighth: R(1, 8), sixteenth: R(1, 16), "thirty-second": R(1, 32) };
const dur = (kind, dots = 0) => { const v = DUR[kind]; if (!v) throw new Error("MusicTheory.dur: unknown value " + kind); return v.mul(R(2 ** (dots + 1) - 1, 2 ** dots)); };
// Meter from a time signature like "3/4". Compound when the top is 6, 9 or 12 (beat = dotted note, three divisions).
function meter(sig){ const [top, bottom] = String(sig).split("/").map(Number);
  if (!(top > 0) || ![1, 2, 4, 8, 16, 32].includes(bottom)) throw new Error("MusicTheory.meter: bad time signature " + sig);
  const unit = R(1, bottom), measure = R(top, bottom);
  const compound = top > 3 && top % 3 === 0, asym = !compound && [5, 7, 11, 13].includes(top);
  const beats = compound ? top / 3 : top, beat = compound ? unit.mul(R(3)) : unit;
  const kind = compound ? "compound" : asym ? "asymmetric" : "simple";
  const group = asym ? `${top} unequal` : ({ 1: "single", 2: "duple", 3: "triple", 4: "quadruple" })[beats] || `${beats}-beat`;
  return { top, bottom, unit, measure, beats, beat, kind, group, division: compound ? 3 : 2, name: `${kind} ${group}` }; }
// Split a list of durations into measures; reports overflow (a note crossing the bar line).
function bar(sig, durs){ const m = meter(sig); const bars = []; let cur = [], sum = R(0);
  for (const d of durs) { cur.push(d); sum = sum.add(d); if (sum.eq(m.measure)) { bars.push({ notes: cur, sum, full: true }); cur = []; sum = R(0); } else if (m.measure.lt(sum)) { bars.push({ notes: cur, sum, full: false, over: sum.sub(m.measure) }); cur = []; sum = R(0); } }
  if (cur.length) bars.push({ notes: cur, sum, full: false, short: m.measure.sub(sum) }); return bars; }

// Acoustics
const harmonics = (f0, n = 8) => Array.from({ length: n }, (_, i) => ({ n: i + 1, f: f0 * (i + 1) }));
const cents = r => 1200 * Math.log2(r);
const nearest = f => { const m = 69 + 12 * Math.log2(f / 440), r = Math.round(m); return { midi: r, cents: 100 * (m - r) }; };
const period = f => 1 / f;

W.MusicTheory = { LET, NAT, R, parse, name, midi, pc, dia, freq, fromDia, spellings, fromMidi, accSym, interval, up, down, invert, ivSemis: (s) => { const { q, size } = ivParse(s); return ivSemis(q, size); },
  SCALES, scale, DEGREE, keySig, sigLetters, sigAcc, CLEFS, staffPos, fromStaffPos, ledgers, DUR, dur, meter, bar, harmonics, cents, nearest, period, SIZE, QLONG };

if (typeof document === "undefined") return;   // Node tests stop here

/* ---------------- 2. MusicKit: drawing and sound ---------------- */
const MT = W.MusicTheory;
// Vector glyph paths in staff-space units (1 = distance between two staff lines), y pointing UP.
// Drawn by Inquire (no font needed): smooth Catmull-Rom curves through these points.
const G_CLEF = [[0.08,0.1],[0.5,0.05],[0.62,-0.42],[0.25,-0.86],[-0.38,-0.82],[-0.78,-0.3],[-0.72,0.45],[-0.25,1.15],[0.32,1.85],[0.6,2.6],[0.52,3.35],[0.22,3.75],[-0.08,3.45],[-0.2,2.7],[-0.08,1.6],[0.12,0.3],[0.28,-1.2],[0.3,-2.05],[0.05,-2.55],[-0.35,-2.55]];
const F_CLEF = [[0,0],[0.18,0.5],[0.7,0.72],[1.18,0.42],[1.3,-0.25],[1.05,-1.0],[0.5,-1.65],[-0.15,-2.1]];
function spline(g, pts, X, Y){ g.beginPath(); g.moveTo(X(pts[0][0]), Y(pts[0][1]));
  for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    g.bezierCurveTo(X(p1[0] + (p2[0] - p0[0]) / 6), Y(p1[1] + (p2[1] - p0[1]) / 6), X(p2[0] - (p3[0] - p1[0]) / 6), Y(p2[1] - (p3[1] - p1[1]) / 6), X(p2[0]), Y(p2[1])); } }

let AC = null, master = null; const voices = new Set();
function audio(){ if (!AC) { const A = W.AudioContext || W.webkitAudioContext; if (!A) return null; AC = new A(); master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination); }
  if (AC.state === "suspended") AC.resume(); master.gain.cancelScheduledValues(AC.currentTime); master.gain.setValueAtTime(0.5, AC.currentTime); return AC; }
const waves = {};
function wave(type){ if (type === "sine" || type === "triangle" || type === "square" || type === "sawtooth") return type;
  if (!waves[type]) { const n = 16, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) im[k] = type === "organ" ? (k <= 4 ? 1 / k : 0) : Math.pow(k, -1.6) * (k % 2 ? 1 : 0.6); waves[type] = AC.createPeriodicWave(re, im); }
  return waves[type]; }

function attach(k){
  const { C, F } = k;
  const mk = {};

  /* ----- staff ----- */
  // const S = mk.staff(c, { x, y, w, gap, clef }): y is the TOP line; gap = staff space in px (default 12).
  mk.staff = (c, o = {}) => {
    const g = c.g, d = c.d, gap = o.gap || 12, x0 = o.x || 0, w = o.w || 300, top = o.y || 0, clef = o.clef || "treble", col = o.color || C.line2;
    const S = { gap, x: x0, w, top, clef, bottom: top + 4 * gap };
    S.y = pos => S.bottom - pos * gap / 2;                       // staff position → pixel y
    S.pos = y => Math.round((S.bottom - y) / (gap / 2));         // pixel y → nearest staff position
    S.lines = () => { for (let i = 0; i < 5; i++) d.line(x0, top + i * gap, x0 + w, top + i * gap, col, 1); };
    const P = (cx, cy, s) => [u => cx + u * s, v => cy - v * s];
    S.clef = (x = x0 + gap * 0.6, color = C.text) => {
      g.save(); g.strokeStyle = color; g.fillStyle = color; g.lineCap = "round"; g.lineJoin = "round";
      if (clef === "treble") { const [X, Y] = P(x + gap * 0.95, S.y(2), gap * 1.12); g.lineWidth = Math.max(1.5, gap * 0.16); spline(g, G_CLEF, X, Y); g.stroke(); d.circle(X(-0.32), Y(-2.28), gap * 0.26, color); }
      else if (clef === "bass") { const [X, Y] = P(x + gap * 0.45, S.y(6), gap); g.lineWidth = Math.max(1.5, gap * 0.17); spline(g, F_CLEF, X, Y); g.stroke(); d.circle(X(0.02), Y(0), gap * 0.3, color); d.circle(X(1.72), Y(0.5), gap * 0.14, color); d.circle(X(1.72), Y(-0.5), gap * 0.14, color); }
      else { const [X, Y] = P(x + gap * 0.3, S.y(CLEFS[clef].line), gap);   // C clef: centre on the C line
        g.fillRect(X(0), Y(2), gap * 0.36, gap * 4); g.fillRect(X(0.55), Y(2), gap * 0.12, gap * 4); g.lineWidth = Math.max(1.4, gap * 0.15);
        for (const s of [1, -1]) { spline(g, [[0.7, 0], [1.0, 0.35 * s], [1.15, 1.1 * s], [1.55, 1.95 * s], [2.05, 1.6 * s], [1.95, 1.05 * s]].map(([a, b]) => [a, b]), X, Y); g.stroke(); d.circle(X(1.88), Y(1.2 * s), gap * 0.2, color); } }
      g.restore(); return gap * (clef === "treble" ? 2.4 : clef === "bass" ? 2.6 : 2.8);
    };
    // Accidental glyph centred at (x, y). a = −2…2 (0 draws a natural).
    S.acc = (x, y, a, color = C.text) => { g.save(); g.strokeStyle = color; g.fillStyle = color; g.lineCap = "butt"; const s = gap;
      if (a === 1) { g.lineWidth = Math.max(1, s * 0.09); for (const dx of [-0.18, 0.18]) { g.beginPath(); g.moveTo(x + dx * s, y - 1.25 * s + dx * 0.25 * s); g.lineTo(x + dx * s, y + 1.25 * s + dx * 0.25 * s); g.stroke(); }
        g.lineWidth = Math.max(1.6, s * 0.2); for (const dy of [-0.38, 0.38]) { g.beginPath(); g.moveTo(x - 0.42 * s, y + dy * s + 0.12 * s); g.lineTo(x + 0.42 * s, y + dy * s - 0.12 * s); g.stroke(); } }
      else if (a === -1) { g.lineWidth = Math.max(1, s * 0.1); g.beginPath(); g.moveTo(x - 0.28 * s, y - 1.55 * s); g.lineTo(x - 0.28 * s, y + 0.5 * s); g.stroke(); g.lineWidth = Math.max(1.4, s * 0.15);
        g.beginPath(); g.moveTo(x - 0.28 * s, y + 0.5 * s); g.bezierCurveTo(x + 0.25 * s, y + 0.15 * s, x + 0.7 * s, y - 0.25 * s, x + 0.4 * s, y - 0.55 * s); g.bezierCurveTo(x + 0.15 * s, y - 0.78 * s, x - 0.12 * s, y - 0.5 * s, x - 0.28 * s, y - 0.25 * s); g.stroke(); }
      else if (a === 0) { g.lineWidth = Math.max(1, s * 0.1); g.beginPath(); g.moveTo(x - 0.25 * s, y - 1.2 * s); g.lineTo(x - 0.25 * s, y + 0.45 * s); g.moveTo(x + 0.25 * s, y - 0.45 * s); g.lineTo(x + 0.25 * s, y + 1.2 * s); g.stroke();
        g.lineWidth = Math.max(1.6, s * 0.2); for (const dy of [-0.3, 0.3]) { g.beginPath(); g.moveTo(x - 0.25 * s, y + dy * s + 0.1 * s); g.lineTo(x + 0.25 * s, y + dy * s - 0.1 * s); g.stroke(); } }
      else if (a === 2) { g.lineWidth = Math.max(1.4, s * 0.13); g.beginPath(); g.moveTo(x - 0.32 * s, y - 0.32 * s); g.lineTo(x + 0.32 * s, y + 0.32 * s); g.moveTo(x + 0.32 * s, y - 0.32 * s); g.lineTo(x - 0.32 * s, y + 0.32 * s); g.stroke(); for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.fillRect(x + u * 0.32 * s - 0.11 * s, y + v * 0.32 * s - 0.11 * s, 0.22 * s, 0.22 * s); }
      else if (a === -2) { g.restore(); S.acc(x - 0.32 * gap, y, -1, color); S.acc(x + 0.32 * gap, y, -1, color); return; }
      g.restore(); };
    S.accW = a => gap * (a === -2 ? 1.6 : a === 2 ? 0.9 : a === -1 ? 1.0 : 0.95);
    // Note: S.note(x, pitch, { dur: "quarter", dots, color, stem: "auto"|"up"|"down"|"none", acc: true|false|a, label, labelColor, ghost })
    // Returns { x, y, pos, stemX, stemEnd } for beams. Accidental (if any) is drawn to the left of x.
    S.note = (x, p, o = {}) => {
      p = MT.parse(p); const pos = MT.staffPos(p, clef), y = S.y(pos), color = o.color || C.text, kind = o.dur || "quarter";
      const hw = gap * 0.66, hh = gap * 0.47, open = kind === "whole" || kind === "half";
      for (const L of MT.ledgers(pos)) d.line(x - hw - gap * 0.4, S.y(L), x + hw + gap * 0.4, S.y(L), o.ledgerColor || col, 1.2);
      const showAcc = o.acc === true ? p.a !== 0 : (typeof o.acc === "number" ? true : false);
      if (showAcc) { const aa = typeof o.acc === "number" ? o.acc : p.a; S.acc(x - hw - gap * 0.3 - S.accW(aa) / 2, y, aa, o.accColor || color); }
      g.save(); g.translate(x, y); g.rotate(-0.33); g.beginPath(); g.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      if (open) { g.lineWidth = Math.max(1.4, gap * (kind === "whole" ? 0.2 : 0.16)); g.strokeStyle = color; g.stroke(); } else { g.fillStyle = color; g.fill(); }
      g.restore();
      for (let i = 0; i < (o.dots || 0); i++) d.circle(x + hw + gap * (0.45 + 0.45 * i), S.y(pos % 2 === 0 ? pos + 1 : pos), gap * 0.13, color);
      let stemX = null, stemEnd = null;
      const dir = o.stem === "none" || kind === "whole" ? null : o.stem === "up" || o.stem === "down" ? o.stem : pos < 4 ? "up" : "down";
      if (dir) { const flags = { eighth: 1, sixteenth: 2, "thirty-second": 3 }[kind] || 0, len = gap * (3.4 + Math.max(0, flags - 1) * 0.6);
        stemX = dir === "up" ? x + hw * 0.92 : x - hw * 0.92; stemEnd = dir === "up" ? y - len : y + len;
        d.line(stemX, y + (dir === "up" ? -1 : 1), stemX, stemEnd, color, Math.max(1.2, gap * 0.1));
        if (flags && !o.beamed) for (let i = 0; i < flags; i++) { const sg = dir === "up" ? 1 : -1, fy = stemEnd + sg * i * gap * 0.8, sx = stemX + (dir === "up" ? -0.5 : 0.5) * Math.max(1.2, gap * 0.1) * 0 ;
          g.save(); g.fillStyle = color; g.beginPath(); g.moveTo(sx, fy); g.bezierCurveTo(sx + gap * 0.1, fy + sg * gap * 0.55, sx + gap * 1.05, fy + sg * gap * 0.8, sx + gap * 0.8, fy + sg * gap * 1.85);
          g.bezierCurveTo(sx + gap * 0.85, fy + sg * gap * 1.05, sx + gap * 0.3, fy + sg * gap * 0.75, sx, fy + sg * gap * 0.6); g.closePath(); g.fill(); g.restore(); } }
      if (o.label) d.text(o.label, x, o.labelY ?? (S.bottom + gap * 2.6 + (pos < -2 ? (-2 - pos) * gap / 2 : 0)), { font: o.labelFont || `600 ${Math.round(gap * 1.15)}px ${F.mono}`, color: o.labelColor || color, align: "center" });
      return { x, y, pos, stemX, stemEnd, dir };
    };
    // Beam a group of notes drawn with { beamed: true } (same stem direction). levels: 1 eighths, 2 sixteenths.
    S.beam = (notes, levels = 1, color = C.text) => { const st = notes.filter(n => n.stemX != null); if (st.length < 2) return; const up = st[0].dir === "up";
      const yb = up ? Math.min(...st.map(n => n.stemEnd)) : Math.max(...st.map(n => n.stemEnd));
      for (const n of st) d.line(n.stemX, n.stemEnd, n.stemX, yb, color, Math.max(1.2, gap * 0.1));
      for (let i = 0; i < levels; i++) { const yy = yb + (up ? 1 : -1) * i * gap * 0.75; g.save(); g.fillStyle = color; g.fillRect(st[0].stemX - 0.5, up ? yy : yy - gap * 0.45, st[st.length - 1].stemX - st[0].stemX + 1, gap * 0.45); g.restore(); } };
    // Rest centred at x. kind: whole, half, quarter, eighth, sixteenth.
    S.rest = (x, kind = "quarter", o = {}) => { const color = o.color || C.text, s = gap; g.save(); g.fillStyle = color; g.strokeStyle = color; g.lineCap = "round"; g.lineJoin = "round";
      if (kind === "whole") g.fillRect(x - 0.6 * s, S.y(6), 1.2 * s, 0.5 * s);
      else if (kind === "half") g.fillRect(x - 0.6 * s, S.y(4) - 0.5 * s, 1.2 * s, 0.5 * s);
      else if (kind === "quarter") { g.lineWidth = Math.max(1.6, s * 0.2); const y0 = S.y(4); g.beginPath(); g.moveTo(x - 0.25 * s, y0 - 1.5 * s); g.lineTo(x + 0.3 * s, y0 - 0.85 * s); g.lineTo(x - 0.2 * s, y0 - 0.2 * s); g.lineTo(x + 0.3 * s, y0 + 0.5 * s); g.stroke();
        g.beginPath(); g.moveTo(x + 0.3 * s, y0 + 0.5 * s); g.quadraticCurveTo(x - 0.5 * s, y0 + 0.3 * s, x - 0.05 * s, y0 + 1.3 * s); g.stroke(); }
      else { const n = kind === "sixteenth" ? 2 : 1, y0 = S.y(5); g.lineWidth = Math.max(1.3, s * 0.12); g.beginPath(); g.moveTo(x + 0.45 * s, y0 - 0.2 * s); g.lineTo(x - 0.05 * s, y0 + (n + 0.6) * s); g.stroke();
        for (let i = 0; i < n; i++) { const yy = y0 + i * s * 0.9; d.circle(x - 0.35 * s + i * -0.1 * s, yy, 0.22 * s, color); g.beginPath(); g.moveTo(x - 0.35 * s, yy + 0.1 * s); g.quadraticCurveTo(x, yy + 0.35 * s, x + 0.45 * s - i * 0.1 * s, yy - 0.2 * s); g.stroke(); } }
      g.restore(); };
    S.bar = (x, type = "single", color = col) => { d.line(x, top, x, S.bottom, color, 1.2); if (type === "final") { d.line(x - gap * 0.45, top, x - gap * 0.45, S.bottom, color, 1); g.save(); g.fillStyle = color; g.fillRect(x - gap * 0.18, top, gap * 0.36, 4 * gap); g.restore(); } };
    // Time signature at x (centre). Returns its width.
    S.time = (x, top, bot, color = C.text) => { const f = `600 ${Math.round(gap * 2.1)}px ${F.math}`; d.text(String(top), x, S.y(6), { font: f, color, align: "center", base: "middle" }); d.text(String(bot), x, S.y(2), { font: f, color, align: "center", base: "middle" }); return gap * 1.8; };
    // Key signature (n sharps or −n flats) starting at x. Returns its width.
    S.key = (x, n, color = C.text) => { if (!n) return 0; const letters = MT.sigLetters(n), a = n > 0 ? 1 : -1;
      // standard placement octaves for each clef (treble sharps: F5 C5 G5 D5 A4 E5 B4; flats: B4 E5 A4 D5 G4 C5 F4)
      const oct = { treble: { s: [5, 5, 5, 5, 4, 5, 4], f: [4, 5, 4, 5, 4, 5, 4] }, bass: { s: [3, 3, 3, 3, 2, 3, 2], f: [2, 3, 2, 3, 2, 3, 2] }, alto: { s: [4, 4, 4, 4, 3, 4, 3], f: [3, 4, 3, 4, 3, 4, 3] }, tenor: { s: [3, 4, 3, 4, 3, 4, 3], f: [3, 4, 3, 4, 3, 4, 3] } }[clef];
      letters.forEach((L, i) => S.acc(x + i * gap * 1.1 + gap * 0.55, S.y(MT.staffPos(L + (a > 0 ? oct.s[i] : oct.f[i]), clef)), a, color)); return letters.length * gap * 1.1 + gap * 0.6; };
    return S;
  };

  /* ----- keyboard ----- */
  // const K = mk.keyboard({ lo: 48, hi: 72 }); each frame: K.draw(c, x, y, w, h, { marks: { 60: C.amber }, labels: true }); K.hit(px, py) → MIDI or null
  mk.keyboard = (o = {}) => {
    const lo = o.lo ?? 48, hi = o.hi ?? 72, isBlack = m => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
    const whites = []; for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
    let geo = null;
    const K = { lo, hi, whites, isBlack };
    K.layout = (x, y, w, h) => { const ww = w / whites.length, keys = {}; whites.forEach((m, i) => keys[m] = { x: x + i * ww, y, w: ww, h, black: false });
      for (let m = lo; m <= hi; m++) if (K.isBlack(m) && keys[m - 1]) keys[m] = { x: keys[m - 1].x + ww * 0.68, y, w: ww * 0.64, h: h * 0.62, black: true };
      geo = { x, y, w, h, ww, keys }; return geo; };
    K.draw = (c, x, y, w, h, opt = {}) => { const d = c.d, gg = c.g, G = K.layout(x, y, w, h), marks = opt.marks || {};
      for (const m of whites) { const kk = G.keys[m], mc = marks[m]; if (mc) { c.g.save(); c.g.globalAlpha = 0.85; d.rr(kk.x + 1, kk.y, kk.w - 2, kk.h, 3, mc, null); c.g.restore(); } else d.rr(kk.x + 1, kk.y, kk.w - 2, kk.h, 3, "#d9dee8", null);
        if (opt.labels !== false && G.ww > 15) { const nm = MT.LET[MT.fromMidi(m).l] + (m % 12 === 0 ? (Math.floor(m / 12) - 1) : ""); d.text(nm, kk.x + kk.w / 2, kk.y + kk.h - 7, { font: `600 ${Math.min(12, Math.round(G.ww * 0.42))}px ${F.mono}`, color: mc ? "#0b0f19" : "#4a5468", align: "center" }); } }
      for (let m = lo; m <= hi; m++) { const kk = G.keys[m]; if (!kk || !kk.black) continue; const mc = marks[m]; d.rr(kk.x, kk.y, kk.w, kk.h, 2, mc || "#141b2b", k.alpha("#000000", 0.6)); }
      if (opt.outline !== false) d.rr(x, y, w, h, 3, null, C.line, 1); return G; };
    K.hit = (px, py) => { if (!geo) return null; for (let m = lo; m <= hi; m++) { const kk = geo.keys[m]; if (kk && kk.black && px >= kk.x && px <= kk.x + kk.w && py >= kk.y && py <= kk.y + kk.h) return m; }
      for (const m of whites) { const kk = geo.keys[m]; if (px >= kk.x && px <= kk.x + kk.w && py >= kk.y && py <= kk.y + kk.h) return m; } return null; };
    K.center = m => geo && geo.keys[m] ? geo.keys[m].x + geo.keys[m].w / 2 : null;
    return K;
  };

  /* ----- sound ----- */
  // mk.play(notes, { dur: 0.6 s, at: seconds from now, type: "piano"|"organ"|"sine"|…, gain: 0.3 })  notes: MIDI numbers, pitch names or { f: Hz }
  mk.play = (notes, o = {}) => { const ac = audio(); if (!ac) return false; const list = Array.isArray(notes) ? notes : [notes];
    const t0 = ac.currentTime + 0.01 + (o.at || 0), dur = o.dur ?? 0.6, gain = (o.gain ?? 0.28) / Math.sqrt(list.length);
    for (const n of list) { const f = typeof n === "number" ? MT.freq(n) : n && n.f ? n.f : MT.freq(n);
      const osc = ac.createOscillator(), env = ac.createGain(); const w = wave(o.type || "piano"); if (typeof w === "string") osc.type = w; else osc.setPeriodicWave(w);
      osc.frequency.value = f; env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(gain * (n.amp ?? 1), t0 + 0.012);
      const hold = o.type === "sine" || o.type === "organ" ? gain * (n.amp ?? 1) : gain * (n.amp ?? 1) * 0.35;
      env.gain.exponentialRampToValueAtTime(Math.max(1e-4, hold), t0 + Math.min(dur, 0.4)); env.gain.setValueAtTime(Math.max(1e-4, hold), t0 + dur); env.gain.exponentialRampToValueAtTime(1e-4, t0 + dur + 0.25);
      osc.connect(env); env.connect(master); osc.start(t0); osc.stop(t0 + dur + 0.3); const v = { osc }; voices.add(v); osc.onended = () => voices.delete(v); }
    return true; };
  // Several notes one after another: mk.seq([[60, 0.5], [64, 0.5], [null, 0.25 /* rest */]], { type })  (durations in seconds). Returns total seconds.
  mk.seq = (steps, o = {}) => { let t = o.at || 0; for (const [n, s] of steps) { if (n !== null && n !== undefined) mk.play(n, { ...o, at: t, dur: Math.max(0.08, s * 0.9) }); t += s; } return t; };
  // Metronome click (accent = downbeat).
  mk.click = (at = 0, accent = false) => { const ac = audio(); if (!ac) return; const t0 = ac.currentTime + 0.01 + at, osc = ac.createOscillator(), env = ac.createGain();
    osc.type = "square"; osc.frequency.value = accent ? 1600 : 1000; env.gain.setValueAtTime(accent ? 0.22 : 0.12, t0); env.gain.exponentialRampToValueAtTime(1e-4, t0 + 0.05); osc.connect(env); env.connect(master); osc.start(t0); osc.stop(t0 + 0.06); const v = { osc }; voices.add(v); osc.onended = () => voices.delete(v); };
  mk.now = () => (AC ? AC.currentTime : 0);
  mk.silence = () => { if (!AC) return; const t = AC.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + 0.04); voices.forEach(v => { try { v.osc.stop(t + 0.05); } catch (e) {} }); voices.clear(); };
  // A lab returns mk.cleanup so sound stops when the page changes.
  mk.cleanup = () => mk.silence();
  // Note name as HTML for readouts: mk.nameH("F#4") → F♯<sub>4</sub>
  mk.nameH = (p, cls = "") => { p = MT.parse(p); return `<span class="m ${cls}">${MT.LET[p.l]}${MT.accSym(p.a)}<sub>${p.o}</sub></span>`; };
  return mk;
}
W.MusicKit = { attach, silence: () => { if (AC) { master.gain.setValueAtTime(0, AC.currentTime); voices.forEach(v => { try { v.osc.stop(); } catch (e) {} }); voices.clear(); } } };
})();
