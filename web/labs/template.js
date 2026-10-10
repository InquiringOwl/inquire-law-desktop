/* Placeholder model for the Lesson Template page (format reference only, no Law content).
   Shows how a lesson talks to its lab: a scrubbable value n, Try-it commands (k.expose) and live values (k.publish)
   that the Concept figure, the Intermediate "Your move" goals and the walk read. Replace with a real model per lesson. */
(function(){
const L = window.LABS;
L["lesson-template"] = k => {
  const { C, F } = k; const c = k.canvas(); const d = c.d;
  let n = 3, runs = 0, lit = 0, playing = false, t = 0;
  const s = k.slider(`<i>n</i>`, 0, 10, 1, n, v => { n = v; playing = false; });
  k.button("+1", () => { if (n < 10) { n++; s.set(n); } }, "btn ghost");
  const pb = k.button("Run", () => { playing = true; lit = 0; t = 0; });
  k.hint("[Placeholder] A hint for the model goes here");
  k.expose({
    set: v => { n = Math.max(0, Math.min(10, Math.round(+v) || 0)); s.set(n); playing = false; },
    plus: () => { if (n < 10) { n++; s.set(n); } },
    play: () => { playing = true; lit = 0; t = 0; }
  });
  k.loop(dt => {
    k.publish("n", n); k.publish("runs", runs);
    if (playing) { t += dt; if (t > (k.reduce ? 0.05 : 0.35)) { t = 0; lit++; if (lit >= n) { playing = false; k.publish("runs", ++runs); k.publish("result", n); } } }
    pb.textContent = playing ? "Running…" : "Run";
    c.begin(); const { w, h } = c;
    const cell = Math.min((w - 40) / 10, 70), ox = (w - cell * 10) / 2, oy = h / 2 - cell / 2 + 10;
    d.text("[Placeholder model]", w / 2, 40, { font: `600 14px ${F.sans}`, color: C.muted, align: "center" });
    for (let i = 0; i < 10; i++) {
      const x = ox + (i + .5) * cell, y = oy + cell / 2, on = i < n, hot = playing ? i < lit : on;
      d.rr(ox + i * cell + 3, oy + 3, cell - 6, cell - 6, 6, null, on ? C.line2 : k.alpha(C.line2, .4), 1);
      if (hot) d.circle(x, y, cell * .28, C.amber);
      else if (on) d.circle(x, y, cell * .28, null, C.amber, 2);
    }
    d.text(String(n), w / 2, oy + cell + 44, { font: `400 34px ${F.math}`, color: C.amber, align: "center" });
  });
  k.loop(() => k.setRO(`<div><h2>[Readout]</h2><div class="ro-big" style="margin-top:8px"><span class="m c1"><i>n</i></span> = <span class="num c1">${n}</span></div></div>
    <div class="ro-rows"><div class="row"><span class="v">[Value]</span><span class="lbl">[What this row of the readout tells the learner]</span></div></div>
    <p class="narr">[Placeholder] One line telling the learner what to try in the model.</p>`));
};
})();
