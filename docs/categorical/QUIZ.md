# Card: quiz (scored questions)

Kit: `web/kits/categorical/quiz.js`. `ctl = k.quiz({items, render(item, state) → html, check(item, picked) → bool, seed})` (also `LabKit.quiz`; `EngLab.quiz` is the same function).
`ctl.pick(v)` → `{answered, picked, correct}` (fires `inquire:quiz`, which feeds Achievements; a second pick is ignored), `ctl.next()`, `ctl.reset()`, `ctl.item`, `ctl.index`, `ctl.total`, `ctl.score {right, tries}`, `ctl.html()`. Order shuffles without repeats; the lab draws and binds the buttons, the kit keeps the state. Put the item list and the `check` rule in the subject kit (or a lab `logic` object) so `tests/` can run every item.
Guard each question's answer with `k.guard([...])` until it is picked.
