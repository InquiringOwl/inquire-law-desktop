/* Achievements (Main Menu → Achievements, Alt+A, route #achievements): a window over the app like Settings and My notes
   (InquireApp.modal). Two tabs: All achievements (the catalogue by category, with progress) and My Achievements (what you
   earned, newest first). Each achievement is worth Achievement Points (AP), shown as a balance in the window's header and
   on the Main Menu's Achievements slot. A toast says "Achievement unlocked" when one is earned.
   Earned + counters are per account in inqlaw.achievements.<user> (_local with no sign-in):
     { earned: { id: time }, stats: { quizRight, quizTries, streak, bestStreak, words[], maps[], themes[], days[], games, gameBest }, seeded }
   The first check for an account awards what is already done without toasts (seeded), so nobody gets a flood after updating.
   Sources: progress (InquireApp.progress), notes and folders (InquireNotes), favourites (inqlaw.favs.<user>), the theme
   (inqlaw.settings), routes (field maps and glossary words seen, days studied), and events:
     inquire:quiz  { correct }   (EngLab.quiz fires it on every answer; other kits can too)
     inquire:game  { score }     (for the Games section once it exists)
   InquireAchievements = { open(tab), close(), points(), list(), record(kind, detail), check() }. Loaded after app.js. */
(function () {
"use strict";
const A = () => window.InquireApp, NS = () => window.InquireNotes;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const user = () => (window.InquireUser ? String(window.InquireUser).toLowerCase() : "");
const key = () => "inqlaw.achievements." + (user() || "_local");
const blank = () => ({ earned: {}, stats: { quizRight: 0, quizTries: 0, streak: 0, bestStreak: 0, words: [], maps: [], themes: [], days: [], games: 0, gameBest: 0 }, seeded: false });
function load() {
  try { const v = JSON.parse(localStorage.getItem(key()) || "null"); if (v && v.earned) { const b = blank(); return Object.assign(b, v, { stats: Object.assign(b.stats, v.stats || {}) }); } } catch (e) {}
  return blank();
}
let D = load();
const save = () => { try { localStorage.setItem(key(), JSON.stringify(D)); } catch (e) {} };
// desktop: wait for sign-in so a session before it never writes into another account's file
let ready = !window.inquireDesktop;

/* ---------- the catalogue ---------- */
/* Categories and achievements are content: Inquire Law starts with none. Add categories as
   [id, name, icon, one-line description], e.g. ["lessons", "Lessons", "▤", "Master lessons in any subject."]. */
const CATS = [];
const CAT0 = ["", "", "◆", ""];
function readJ(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function facts() {
  const P = A() && A().progress ? A().progress() : { mastered: 0, bySubject: {}, byGroup: {}, fields: [] };
  const notes = NS() ? NS().list() : [], folders = NS() && NS().folders ? NS().folders() : [];
  const favs = readJ("inqlaw.favs." + (window.InquireUser || "_local"), { items: [] });
  const st = D.stats;
  return { P, notes: notes.length, linked: notes.filter(n => n.links && n.links.length).length, folders: folders.length, favs: (favs.items || []).length,
    subjects: Object.keys(P.bySubject).length, groups: Object.keys(P.byGroup).length, fieldsDone: P.fields.filter(f => f.done >= f.total).length,
    quizRight: st.quizRight, best: st.bestStreak, words: st.words.length, maps: st.maps.length, themes: st.themes.filter(t => t !== "capsuleer").length,
    days: st.days.length, games: st.games, gameBest: st.gameBest };
}
// [id, category, name, description, points, goal, value(facts)]; soon = not reachable yet
function catalogue() {
  // [id, category, name, description, points, goal, value(facts), {soon, colour}]. facts() lists every input an
  // achievement can read (mastered lessons, fields done, subjects, quiz answers and streaks, notes, maps, words, days …).
  // Example: ["first-lesson", "lessons", "First Steps", "Master your first lesson.", 10, 1, f => f.P.mastered]
  const L = [];
  return L.map(([id, cat, name, desc, pts, goal, val, o]) => Object.assign({ id, cat, name, desc, pts, goal, val }, o || {}));
}
const points = () => catalogue().reduce((t, a) => t + (D.earned[a.id] ? a.pts : 0), 0);

/* ---------- checking ---------- */
let checkT = null;
const soon = () => { clearTimeout(checkT); checkT = setTimeout(check, 250); };
function check() {
  if (!ready) return [];
  const f = facts(), fresh = [];
  catalogue().forEach(a => { if (!a.soon && !D.earned[a.id] && a.val(f) >= a.goal) { D.earned[a.id] = Date.now(); fresh.push(a); } });
  const quiet = !D.seeded; D.seeded = true;
  if (fresh.length || quiet) save();
  if (fresh.length && !quiet) { toast(fresh); window.dispatchEvent(new CustomEvent("inquire:achievements", { detail: { ids: fresh.map(a => a.id) } })); }
  if (win) draw();
  paintSlot();
  return fresh;
}
function today() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function seen() {
  if (!ready) return;
  const st = D.stats, c = A() ? A().context() : {}, add = (arr, v) => { if (v && !arr.includes(v)) { arr.push(v); return true; } return false; };
  let ch = add(st.days, today());
  if (c.view === "math" && c.subject) ch = add(st.maps, c.subject) || ch;
  if (c.gword) ch = add(st.words, c.gword) || ch;
  const th = readJ("inqlaw.settings", {}).theme; if (th) ch = add(st.themes, th) || ch;
  if (ch) save();
  soon();
}
function record(kind, d) {
  if (!ready) return;
  const st = D.stats;
  if (kind === "quiz") { st.quizTries++; if (d && d.correct) { st.quizRight++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); } else st.streak = 0; }
  else if (kind === "game") { st.games++; st.gameBest = Math.max(st.gameBest, +(d && d.score) || 0); }
  save(); soon();
}

// the Main Menu's Achievements slot (drawn by app.js, which loads first)
function paintSlot() {
  const el = document.getElementById("achslot"); if (!el) return;
  const L = catalogue(), got = L.filter(a => D.earned[a.id]).length, tag = el.querySelector(".ach-tag"), n = el.querySelector(".ach-n");
  if (tag) tag.textContent = "◆ " + points().toLocaleString("en-US") + " AP";
  if (n) n.textContent = got + " of " + L.filter(a => !a.soon).length + " earned.";
}
/* ---------- toast ---------- */
let tbox = null;
function toast(list) {
  if (!tbox) { tbox = document.createElement("div"); tbox.className = "ach-toasts"; tbox.setAttribute("aria-live", "polite"); document.body.appendChild(tbox); }
  const many = list.length > 3, items = many ? [{ name: list.length + " achievements", pts: list.reduce((t, a) => t + a.pts, 0), cat: "lessons" }] : list;
  items.forEach((a, i) => {
    const t = document.createElement("button"); t.type = "button"; t.className = "ach-toast win";
    t.innerHTML = `<span class="ach-medal sm">${(CATS.find(c => c[0] === a.cat) || CAT0)[2]}</span><span><small>Achievement unlocked</small><b>${esc(a.name)}</b></span><span class="ach-ap">+${a.pts} AP</span>`;
    t.onclick = () => { t.remove(); open("mine"); };
    setTimeout(() => tbox.appendChild(t), i * 350);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, 6000 + i * 350);
  });
}

/* ---------- window ---------- */
let win = null, tab = "all", cat = "all";
const fmt = n => n.toLocaleString("en-US");
const when = t => new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
function open(t) {
  if (t) tab = t === "mine" ? "mine" : "all";
  if (!A() || !A().modal) return;
  if (win && !win.closed) { draw(); return win; }
  check();
  win = A().modal("achievements", { title: "Achievements", cls: "mw-ach" });
  win.cleanup.push(() => { win = null; });
  win.head.innerHTML = `<span class="ach-bal" title="Achievement Points: earned by completing achievements"><span class="ach-coin" aria-hidden="true">◆</span><b class="num"></b><small>AP</small></span>
    <button type="button" class="btn-s ach-mine" aria-pressed="false">★ My Achievements</button>`;
  win.head.querySelector(".ach-mine").onclick = () => { tab = tab === "mine" ? "all" : "mine"; draw(); };
  win.body.addEventListener("click", e => {
    const b = e.target.closest("[data-tab],[data-cat]"); if (!b) return;
    if (b.dataset.tab) tab = b.dataset.tab; else cat = b.dataset.cat;
    draw();
  });
  draw();
  return win;
}
function draw() {
  if (!win || win.closed) return;
  const L = catalogue(), f = facts(), pts = points(), got = L.filter(a => D.earned[a.id]), total = L.filter(a => !a.soon).length;
  win.head.querySelector(".ach-bal b").textContent = fmt(pts);
  const mb = win.head.querySelector(".ach-mine"); mb.setAttribute("aria-pressed", String(tab === "mine")); mb.textContent = tab === "mine" ? "◀ All achievements" : "★ My Achievements";
  const card = a => {
    const v = Math.min(a.goal, a.val(f)), done = !!D.earned[a.id], c = CATS.find(x => x[0] === a.cat) || CAT0;
    return `<article class="ach-card${done ? " done" : ""}${a.soon ? " soon" : ""}"${a.colour ? ` style="--ac:${a.colour}"` : ""}>
      <span class="ach-medal">${done ? "✓" : c[2]}</span>
      <div class="ach-txt"><h3>${esc(a.name)}</h3><p>${a.desc}</p>
        ${done ? `<span class="ach-when">Earned ${when(D.earned[a.id])}</span>` : a.soon ? `<span class="ach-when">Coming with Games</span>`
          : `<span class="ach-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${a.goal}" aria-valuenow="${v}"><i style="width:${(v / a.goal * 100).toFixed(1)}%"></i></span><span class="ach-prog num">${fmt(v)} / ${fmt(a.goal)}</span>`}</div>
      <span class="ach-pts num">${a.pts}<small>AP</small></span></article>`;
  };
  const tabs = `<div class="ach-tabs" role="tablist"><button type="button" role="tab" data-tab="all" aria-selected="${tab === "all"}">All achievements</button><button type="button" role="tab" data-tab="mine" aria-selected="${tab === "mine"}">My Achievements <span class="num">${got.length}</span></button>
    <span class="ach-sum"><span class="ach-bar big"><i style="width:${(got.length / Math.max(1, total) * 100).toFixed(1)}%"></i></span><span class="num">${got.length} / ${total}</span> earned</span></div>`;
  let body;
  if (tab === "mine") {
    const st = D.stats, rows = got.sort((a, b) => D.earned[b.id] - D.earned[a.id]);
    body = `<div class="ach-stats">${[[fmt(pts), "Achievement Points"], [fmt(got.length), "Achievements earned"], [fmt(f.P.mastered), "Lessons mastered"], [fmt(f.fieldsDone), "Fields complete"], [fmt(st.quizRight), "Quiz answers right"], [fmt(st.bestStreak), "Best quiz streak"], [fmt(f.days), "Days studied"]]
        .map(([n, l]) => `<div><b class="num">${n}</b><span>${l}</span></div>`).join("")}</div>`
      + (rows.length ? `<div class="ach-grid">${rows.map(card).join("")}</div>`
        : `<p class="ach-empty">Nothing earned yet. Master a lesson, answer a quiz question or write a note to earn your first Achievement Points.</p>`);
  } else {
    const chips = `<div class="ach-cats" role="group" aria-label="Category">${[["all", "All", "◎"]].concat(CATS).map(([id, nm, ic]) => { const n = id === "all" ? L : L.filter(a => a.cat === id);
      return `<button type="button" class="gl-chip sm" data-cat="${id}" aria-pressed="${cat === id}"><span class="g">${ic}</span>${esc(nm)}<span class="n">${n.filter(a => D.earned[a.id]).length}/${n.length}</span></button>`; }).join("")}</div>`;
    body = chips + CATS.filter(c => cat === "all" || c[0] === cat).map(([id, nm, ic, line]) => {
      const list = L.filter(a => a.cat === id).sort((a, b) => (!!D.earned[b.id] - !!D.earned[a.id]) || 0);
      return `<section class="ach-sec"><div class="ach-sh"><span class="ach-sic">${ic}</span><h3>${esc(nm)}</h3><span class="ln">${esc(line)}</span></div><div class="ach-grid">${list.map(card).join("")}</div></section>`;
    }).join("") + (L.length ? "" : `<p class="ach-empty">No achievements yet. They arrive with Inquire Law’s first subjects.</p>`);
  }
  const sc = win.body.querySelector(".ach-scroll"), y = sc ? sc.scrollTop : 0;
  win.body.innerHTML = tabs + `<div class="ach-scroll">${body}</div>`;
  if (sc) win.body.querySelector(".ach-scroll").scrollTop = y;
}

/* ---------- wiring ---------- */
window.addEventListener("inquire:route", seen);
window.addEventListener("inquire:mastered", soon);
window.addEventListener("inquire:progress-changed", () => { D = load(); soon(); }); // a restored backup may carry achievements
window.addEventListener("inquire:notes-changed", soon);
window.addEventListener("inquire:quiz", e => record("quiz", e.detail));
window.addEventListener("inquire:game", e => record("game", e.detail));
window.addEventListener("storage", e => { if (e.key && /^inqlaw\.(favs|settings|notefolders)/.test(e.key)) soon(); });
window.addEventListener("click", e => { if (e.target.closest && e.target.closest(".fav, .set-theme, .set-th, [data-theme]")) setTimeout(seen, 50); }, true);
window.addEventListener("inquire:signed-in", () => { ready = true; D = load(); if (win) win.close(); seen(); });
window.InquireAchievements = { open, close: () => win && win.close(), points, list: () => catalogue().map(a => ({ id: a.id, cat: a.cat, name: a.name, pts: a.pts, goal: a.goal, earned: D.earned[a.id] || 0, soon: !!a.soon })), record, check };
window.addEventListener("inquire:route", paintSlot);
paintSlot();
if (ready) setTimeout(seen, 0);
})();
