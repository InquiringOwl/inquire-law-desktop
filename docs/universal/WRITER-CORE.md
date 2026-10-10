# Writer core (every subject)

The one brief every writer reads first. Then read the **cards your spec names** (`docs/categorical/*.md`), your **subject card** (`docs/subjects/<SUBJECT>.md`) and your batch in the field's tree spec. Nothing else: not CLAUDE.md, not whole content or lab files, not the kit sources. For the shape and voice of a finished page run `node tools/excerpt.js <any written id>`.

## Page file: `web/content/<field>/<id>.js`
```js
window.ARITH = window.ARITH || {};
ARITH["<id>"] = {
  title, short (≤ 60 chars), grade, hours, voice: "plain",
  eyebrow: "Area · subtopic",
  hero: `…`,      // ONE short line in the subject's markup, coloured with the lab's keys
  lede (1–2 sentences), plain (2–4 <p>, the idea without jargon first), formal (1–3 <p> and/or <div class="display">…</div>),
  legend: [{ c: "c1", sym: `…`, name, desc }],   // 3–5, colours = the lab's colour keys
  steps: { title, items: [3–7 HTML steps] },
  example: { prompt, lines: [{ math, note }], answer },   // worked example, 3–8 lines
  why, careers: [{ role, use }] (5–7, real and specific), life: [4–6 strings], fields: [{ name, use }] (3–5),
  prereqWhy: { id: "…" },  // one per prereq, including ids in other fields
  unlocksWhy: { id: "…" }, // one per unlock in the spec, written or still planned (validate accepts both)
  beyond: [{ field, why }] (2–4 later fields), mistakes: [{ wrong, fix }] (2–4),
  practice: [{ q, a }] (exactly 4, easy → hard, brief working in a), origin (accurate history, or omit)
};
```
Escaped text (no tags): `careers`, `fields`, `beyond`, `life`, `example.lines[].note`. Everything else is HTML. Backtick strings; never `${` inside them. Ids are unique across all fields.

Data file: your node is listed in the field's `web/src/data-<field>.js` with `planned: true`. When your page and lab exist, delete that flag **on your node's line only** (parallel writers edit the same file).

## Voice and markup
College level, standard order and terms of the field (the subject card names the reference text). Every number correct; a saved check proves it. Plain short sentences; no em-dash asides, no "not X but Y", no stock phrases, no emoji, links or markdown; never the words "coming soon" (the smoke test reads them as an unwritten page). Defined term `<b>term</b>`. Colours `c1`–`c5` (amber, cyan, pink, violet, green) exactly as the lab's keys. `<span class="dim">…</span>` for de-emphasis. Subject markup (math spans, story tokens, code) is in the subject card.

## Labs: what every lab shares
One lab file per batch, `web/labs/<prefix>-<n>.js`, `L["<id>"] = k => {…}` with `const L = window.LABS`. Target **4–8 KB per lab**: write only what is unique to the topic. A rule a lab needs (which answer is right, exact forms, scoring) goes in the subject kit with a test (or, in a parallel wave, in your report under "kit additions"), never as a private helper in the lab.

**Universal kit** (every `k`, `web/kits/universal/core.js`):
- Stage: `c = k.canvas()` (`c.w c.h c.begin() c.xy(e) c.d.text/line/rect/rr/circle/arrow/pow/width`), `k.dom()` (absolute DOM layer), `k.loop(dt => …)`, `k.every(ms, fn)`, `k.fontsReady(cb)`.
- Controls (below the stage): `k.slider(label, min, max, step, value, fn, fmt)`, `k.number`, `k.select(label, [[v, text]], v, fn)`, `k.button(label, fn, "btn"|"btn ghost"|"btn-s")`, `k.check`, `k.modes([[key, label]…], active, fn)` (mode buttons, top left of the stage), `S = k.params([{key, min, max, step, value, cls, fmt}], onChange)` (sliders), `k.group("mode", () => {…})` + `k.showGroup("mode")`.
- **Numbers the learner can change** (the interaction rule): `S = k.vars([{key, value, min, max, step, cls, label, fmt, typeStep, px}], onChange)`; `S.html("a")` is a scrubbable number to put inside ANY markup you render (readout, steps panel, `k.eqline`, DOM panels). The learner drags it left/right, clicks it to type (3/4, −2.5, 2π/3, √2), or Tabs to it and uses ↑/↓. `S.a` is the value, `S.set("a", v)` sets it without onChange. For coefficients inside an equation use **`S.term("b", {v: "<i>x</i>", first})`** → " + 3x" / " − 3x" (sign outside the scrubbable number; never print "+ −2x" or "1x" by hand). `k.eqline(html, tag)` shows a full-width editable equation strip in the controls (call every frame; cheap).
- Layout: `pad = k.split(c, host, {side, frac, hfrac, minWide, full, off})` (DOM panel beside the plot on wide stages, above it on phones, below the mode buttons; returns the plot padding), `k.hint(text)` (one at a time; `""` clears), `k.smooth(view, target, dt)` (eased values).
- Output: `k.readout({title, big, rows: [{lhs, v, cls, lbl}], landmark: {hit, big, note}, narr})`; `title` is set in capitals, so formulas go in `big` or rows. Short enough not to scroll on desktop, exact values, one landmark that lights (`hit`) at the topic's key moment, `narr` = what to try next. `k.setRO(html)` for a custom readout.
- **`k.guard(["x = 3", …])`**: declare the current mode's answers; layoutcheck fails if any is visible before the learner takes a step. Call it in every mode that asks something, again whenever the numbers change (the answers change with them), and `k.guard([])` in free-exploration modes.
- Helpers: `k.C.amber/cyan/pink/violet/green/text/muted/faint/ink`, `k.F.math/mono/ui/sans`, `k.alpha(hex, a)`, `k.fmt(v, d)`, `k.gcd`, `k.lcm`, `k.shuffle(arr, seed)`, `k.esc`, `k.reduce` (reduced motion), `k.coarse` (touch screen), `k.css(id, text)` (inject a style once; prefix selectors with your lab's class).
Lay out from `c.w`/`c.h` (the stage can be 340 px wide on a phone). No alert/confirm, no localStorage. Sound only from a click or key.

## Checks
Every page has a saved check (`checks/<field>/<id>.py` for math/physics/music/CS, `checks/labs/<id>.test.js` for English lab logic) covering `example`, every `practice[i]` and any number or claim in `formal`. Compute the truth independently; type the page's numbers in. Then stamp it (`python3 tools/mathcheck.py --stamp <id>`, refused unless all pass). Never weaken a check to pass a wrong page. Lab rules get logic tests in `tests/<subject>.test.js` (`node tools/labtest.js <name>`): test every combination a lab can produce there, not by clicking.

## Finish each batch (text first, one image per topic last)
1. `node tools/finish.js <ids>` → build, validate, mathcheck, labtest. Fix until `FINISH ok`.
2. Cloud (Chromium): `node tools/finish.js --browser <ids>` → also layoutcheck (fix to 0) and one contact sheet per topic (`/tmp/codex-sheet/<id>.png`, ~0.65 scale). Read each sheet ONCE; `MODES=…` re-shoots only the modes you changed; `BIG=1` only if a detail is unreadable.
3. Prototype a lab before its page exists: `LABFILE=web/labs/<file>.js node tools/layoutcheck.js <existing id>` with `L["<existing id>"]` pointed at your lab for the trial.
4. Report back in exactly this shape, nothing else:
```
BATCH <name>: <ids>
files: <paths written>
finish: ok | FAIL <step>
checks: <n passed> · layout: 0 · sheets: looked
kit additions: <rules/helpers added + tests, or needed for the next wave, or none>
doubts: <anything the reviewer must look at, or none>
```
