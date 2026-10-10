/* ============ Categorical kit: stepper (worked solutions revealed one step at a time) ============
   Shared by every subject that walks through steps (math solutions, physics problems, proofs, CS traces' controls).
     k.stepper(count, onStep, {start, ms}) → {play, pause, step, reset, finish, k}   Play/Step/Reset buttons in the controls
     k.stepsPanel(host, {todo}) → {el, set(lines, cur)}   lines = [{tag, eq, why}]; lines after `cur` render as empty
                                                          placeholders (never their content), so answers can't show early
     LabKit.reveal(lines, k)  DOM-free: lines with everything after index k replaced by null (MathRules.reveal alias) */
(function(){
const W = typeof window !== "undefined" ? window : globalThis;
const reveal = (lines, k) => lines.map((l, i) => (i <= k ? l : null));
W.LabKit = W.LabKit || {}; W.LabKit.reveal = reveal;
if (typeof document === "undefined" || !W.LabKit.make) return;
W.LabKit.css("mk-steps-css", `.mk-steps{flex:1 1 300px;min-width:0;display:grid;gap:4px;font:400 19px/1.45 var(--math);align-content:start}
.mk-steps .st{display:grid;grid-template-columns:96px minmax(0,1fr);align-items:baseline;gap:0 10px;padding:5px 8px;border-radius:4px;color:var(--muted)}
.mk-steps .st.cur{background:rgba(242,184,75,.07);color:var(--text);box-shadow:inset 2px 0 0 var(--amber)}
.mk-steps .st.todo{color:var(--faint)}
.mk-steps .tag{font:600 11px/1.2 var(--ui);letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
.mk-steps .st.cur .tag{color:var(--amber)}
.mk-steps .eq{overflow-x:auto;overflow-y:hidden;min-width:0}
.mk-steps .why{grid-column:2;font:12.5px/1.4 var(--sans);color:var(--faint)}
@media (max-width:560px){.mk-steps{font-size:17px}.mk-steps .st{grid-template-columns:minmax(0,1fr)}.mk-steps .why{grid-column:1}}`);
W.LabKit.extend(kit => {
  kit.stepper = (count, onStep, opts = {}) => {
    let k = opts.start ?? 0, playing = false, stop = null;
    const btnP = kit.button("Play", () => playing ? pause() : play());
    const btnS = kit.button("Step", () => { pause(); step(); }, "btn ghost");
    const btnR = kit.button("Reset", () => { pause(); k = 0; onStep(k); }, "btn ghost");
    function step(){ if (k < count()) { k++; onStep(k); } else pause(); }
    function play(){ if (k >= count()) { k = 0; onStep(k); } playing = true; btnP.textContent = "Pause"; stop = kit.every(opts.ms || 900, () => { if (k >= count()) pause(); else step(); }); }
    function pause(){ playing = false; btnP.textContent = "Play"; if (stop) stop(); stop = null; }
    return { play, pause, step, buttons: [btnP, btnS, btnR], get k(){ return k; }, set k(v){ k = v; }, reset(){ pause(); k = 0; onStep(k); }, finish(){ pause(); k = count(); onStep(k); } };
  };
  kit.stepsPanel = (host, opt = {}) => {
    const el = document.createElement("div"); el.className = "mk-steps"; host.appendChild(el); let last = "";
    return { el, set(lines, cur){ const html = reveal(lines, cur).map((l, i) => l ? `<div class="st${i === cur ? " cur" : ""}"><span class="tag">${l.tag || "step " + (i + 1)}</span><span class="eq">${l.eq}</span>${l.why ? `<span class="why">${l.why}</span>` : ""}</div>` : `<div class="st todo"><span class="tag">${opt.todo ? lines[i] && lines[i].tag || "" : ""}</span><span class="eq">·&nbsp;·&nbsp;·</span></div>`).join(""); if (html !== last) { el.innerHTML = html; last = html; } } };
  };
});
})();
