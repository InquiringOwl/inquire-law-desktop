/* ============ Categorical kit: quiz (scored questions, any subject) ============
   LabKit.quiz(cfg) → controller (DOM-free, tested; EngLab.quiz is the same function):
     cfg.items: array; cfg.render(item, state) → html (state: {answered, picked, correct}); cfg.check(item, picked) → bool;
     cfg.seed (optional, repeatable order for tests)
     ctl.pick(v) → state (fires window "inquire:quiz" {correct} for Achievements), ctl.next(), ctl.reset(),
     ctl.item, ctl.index, ctl.total, ctl.state, ctl.score {right, tries}, ctl.html()
   Order shuffles without repeats; the lab draws and binds, the kit keeps the state. Also on every k as k.quiz. */
(function(){
const W = typeof window !== "undefined" ? window : globalThis;
W.LabKit = W.LabKit || {};
const shuffle = (W.LabKit.rules && W.LabKit.rules.shuffle) || ((a) => a.slice());
const quiz = cfg => {
  let order = shuffle(cfg.items.map((_, i) => i), cfg.seed), pos = 0;
  const ctl = {
    score: { right: 0, tries: 0 },
    state: { answered: false, picked: null, correct: null },
    get item(){ return cfg.items[order[pos]]; },
    get index(){ return pos; },
    get total(){ return cfg.items.length; },
    pick(v){ if (ctl.state.answered) return ctl.state; const ok = !!cfg.check(ctl.item, v); ctl.state = { answered: true, picked: v, correct: ok }; ctl.score.tries++; if (ok) ctl.score.right++; if (typeof W.dispatchEvent === "function" && typeof CustomEvent !== "undefined") W.dispatchEvent(new CustomEvent("inquire:quiz", { detail: { correct: ok } })); return ctl.state; }, // inquire:quiz → Achievements
    next(){ pos++; if (pos >= order.length) { order = shuffle(order, cfg.seed == null ? null : cfg.seed + 1); pos = 0; } ctl.state = { answered: false, picked: null, correct: null }; },
    reset(){ ctl.score = { right: 0, tries: 0 }; pos = 0; ctl.state = { answered: false, picked: null, correct: null }; },
    html(){ return cfg.render(ctl.item, ctl.state); }
  };
  return ctl;
};
W.LabKit.quiz = quiz;
if (W.LabKit.extend) W.LabKit.extend(k => { k.quiz = quiz; });
})();
