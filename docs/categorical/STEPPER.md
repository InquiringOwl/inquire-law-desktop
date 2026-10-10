# Card: stepper (worked solutions, one step at a time)

Kit: `web/kits/categorical/stepper.js` (on every `k`).
- `ST = k.stepper(() => count, k => {…}, {start, ms})` → Play / Step / Reset buttons in the controls; `ST.k` current step, `ST.reset()`, `ST.finish()`, `ST.play()`, `ST.pause()`.
- `SP = k.stepsPanel(host, {todo})` with `host = k.dom()` (usually placed by `k.split`); `SP.set([{tag, eq, why}], cur)` renders steps ≤ `cur`, later ones as empty placeholders (never their content), so an answer can't show early. `todo: true` shows the later steps' tags.
- `LabKit.reveal(lines, k)` (DOM-free) is the same cut, for your own panels.
Pattern: a **Worked** mode steps through the solution of the learner's current numbers (built from `k.vars`: scrub a coefficient and the worked solution is redone for the new problem; reset the stepper to 0 on change); a **Your turn** mode hides the answer (`k.guard`) until the learner commits. Keep step lines short enough not to scroll sideways on desktop; layoutcheck flags readout/step lines that do.
