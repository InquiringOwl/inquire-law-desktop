(function(){
"use strict";
const $ = (s, r=document) => r.querySelector(s);
const h = (tag, attrs={}, html) => { const e = document.createElement(tag); for (const k in attrs) { if (k === "class") e.className = attrs[k]; else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); } if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const T = window.ARITH || {};
// Every charted field has its own tree in DB.trees. Topic ids are unique across fields,
// and a node's prerequisites may come from another field (e.g. Pre-Algebra ← Arithmetic).
const TREES = DB.trees;
const NODES = [];
Object.entries(TREES).forEach(([f, tr]) => tr.nodes.forEach(n => { n.field = f; NODES.push(n); }));
const NODE = Object.fromEntries(NODES.map(n => [n.id, n]));
const fieldNodes = f => (TREES[f] ? TREES[f].nodes : []);
const charted = f => !!TREES[f];
const fieldOf = id => (NODE[id] ? NODE[id].field : DB.defaultField);
// unlocks
NODES.forEach(n => n.post = []);
NODES.forEach(n => { n.pre = n.pre.filter(p => { if (NODE[p]) return true; console.warn("Unknown prerequisite", p, "for", n.id); return false; }); n.pre.forEach(p => NODE[p].post.push(n.id)); });
// reading order: by column then row
const ORDERS = Object.fromEntries(Object.keys(TREES).map(f => [f, fieldNodes(f).slice().sort((a,b) => a.col - b.col || a.row - b.row).map(n => n.id)]));
const doneIn = f => fieldNodes(f).filter(n => mastered.has(n.id)).length;
// Subjects (Mathematics, Physics …): each field belongs to one; each subject has its own field map.
const SM = DB.subjectMaps;
const subjOf = f => (DB.fields[f] && DB.fields[f].subject) || DB.defaultSubject;
const subjFields = sub => Object.keys(DB.fields).filter(k => subjOf(k) === sub);
const subjTrees = sub => Object.keys(TREES).filter(k => subjOf(k) === sub);
// Math a node needs: a charted topic id, or "field:Topic name" for a field not yet charted.
const mathRef = m => { const i = m.indexOf(":"); if (i < 0) return NODE[m] ? { id: m } : null; const f = m.slice(0, i); return DB.fields[f] ? { field: f, name: m.slice(i + 1) } : null; };

/* ---------- persistence (per-viewer convenience) ---------- */
const store = {
  get(k, d){ try { const v = localStorage.getItem("inqlaw." + k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem("inqlaw." + k, JSON.stringify(v)); } catch(e){} }
};
// Progress belongs to the signed-in account (InquireKeys in notes.js; "inqlaw.mastered" when nobody is signed in).
const progKey = () => (window.InquireKeys ? InquireKeys.progress() : "inqlaw.mastered");
const loadMastered = () => { try { const v = JSON.parse(localStorage.getItem(progKey()) || "[]"); return new Set(Array.isArray(v) ? v : []); } catch(e){ return new Set(); } };
let mastered = loadMastered();
const saveMastered = () => { try { localStorage.setItem(progKey(), JSON.stringify([...mastered])); } catch(e){} window.dispatchEvent(new CustomEvent("inquire:mastered")); };
// Settings → Data & progress (import / reset) rewrites the progress: reload it and redraw.
window.addEventListener("inquire:progress-changed", () => { mastered = loadMastered(); render(); });
function stateOf(id){
  if (mastered.has(id)) return "mastered";
  return NODE[id].pre.every(p => mastered.has(p)) ? "avail" : "locked";
}

/* ---------- app state + routing ---------- */
const S = { view: "menu", subject: DB.defaultSubject, field: DB.defaultField, topic: null, gword: null, navMode: "fields", glScope: null, glField: null, openGroups: store.get("groups", []), pan: {} };
const app = $("#app");
const viewEl = $("#view");
let cleanup = [];
function clearView(){ cleanup.forEach(f => { try{ f(); }catch(e){} }); cleanup = []; viewEl.innerHTML = ""; }

function go(next, push = true){
  if (WIN_VIEWS[next.view]) { // a window, not a screen: open it over whatever is on screen (the Main Menu on a cold start)
    WIN_VIEWS[next.view]();
    if (viewEl.childElementCount) { try { history.replaceState(history.state, "", "#" + curTok()); } catch(e){} return; }
    next = { view: "menu", topic: null }; push = false; winHash = true;
  } else closeWins();
  const prev = { view: S.view, subject: S.subject };
  if (next.g) { Object.assign(G, next.g); next = { ...next }; delete next.g; }
  if (!("gword" in next)) next = { ...next, gword: null };
  Object.assign(S, next);
  if (S.gword) { if (S.view === "math" && GWORDS[S.gword]) S.navMode = "glossary"; else S.gword = null; }
  if (S.topic && NODE[S.topic]) S.field = fieldOf(S.topic);
  if (S.field !== "map" && DB.fields[S.field]) S.subject = subjOf(S.field);
  if (!SM[S.subject]) S.subject = DB.defaultSubject;
  render();
  // every move to another screen fades in like the Settings window; inside one subject only the main pane does
  viewIn(prev.view === "math" && S.view === "math" && prev.subject === S.subject ? $(".work > .main", viewEl) : viewEl);
  const tok = curTok();
  if (winHash) { winHash = false; try { history.replaceState(history.state, "", "#" + tok); } catch(e){} }
  if (push) { try { history.pushState({ ...next, view: S.view, subject: S.subject, field: S.field, topic: S.topic, gword: S.gword, ...(S.view === "glossary" ? { g: { sub: G.sub, word: G.word, field: G.field } } : {}) }, "", "#" + tok); } catch(e){} }
  store.set("last", { view: S.view, subject: S.subject, field: S.field, topic: S.topic });
  window.dispatchEvent(new CustomEvent("inquire:route"));
}
function curTok(){
  return (S.view === "glossary" ? gTok() : S.topic ? S.topic : (S.view === "math" ? (S.field === "map" ? "field-map" + (S.subject !== DB.defaultSubject ? "-" + S.subject : "") : "field-" + S.field) : S.view)) + (S.view === "math" && S.gword ? "~" + encodeURIComponent(S.gword) : "");
}
let winHash = false;

/* ---------- windows over the app (My notes, Achievements) ----------
   Like Settings and the New note dialog: the app behind fogs and eases back (body.mw-open, settings.css), ✕, Esc
   (settings.js) or a click on the fog closes. Routes #notes / #achievements open them over the screen you are on.
   modalWin(id, { title, sub, cls }) → { ov, win, body, head, cleanup: [], close() }; one window at a time. */
const MW = {};
function closeWins(except){ Object.keys(MW).forEach(k => { if (k !== except) MW[k].close(); }); }
function modalWin(id, o = {}){
  if (MW[id]) return MW[id];
  closeWins(id);
  const last = document.activeElement;
  const ov = h("div", { class: "mw-ov", "data-mw": id });
  ov.innerHTML = `<div class="mw-win win ${o.cls || ""}" role="dialog" aria-modal="true" aria-labelledby="mw-t-${id}">
    <header class="set-h mw-h"><span class="dot"></span><h2 id="mw-t-${id}">${esc(o.title || "")}</h2>${o.sub ? `<span class="mw-sub">${o.sub}</span>` : ""}<span class="mw-hx"></span><button type="button" class="set-x" aria-label="Close ${esc(o.title || "window")}">✕</button></header>
    <div class="mw-body"></div></div>`;
  document.body.appendChild(ov);
  const m = { id, ov, win: $(".mw-win", ov), body: $(".mw-body", ov), head: $(".mw-hx", ov), cleanup: [], closed: false,
    close(){
      if (m.closed) return; m.closed = true; delete MW[id];
      m.cleanup.forEach(f => { try { f(); } catch(e){} }); m.cleanup = [];
      if (!Object.keys(MW).length) document.body.classList.remove("mw-open");
      ov.classList.add("out"); setTimeout(() => ov.remove(), 260);
      if (last && document.contains(last)) try { last.focus({ preventScroll: true }); } catch(e){}
      window.dispatchEvent(new CustomEvent("inquire:window", { detail: { id, open: false } }));
    } };
  MW[id] = m;
  $(".set-x", ov).onclick = () => m.close();
  ov.addEventListener("pointerdown", e => { if (e.target === ov) m.close(); });
  requestAnimationFrame(() => { if (!m.closed) document.body.classList.add("mw-open"); });
  setTimeout(() => { if (!m.closed && !m.win.contains(document.activeElement)) m.win.focus({ preventScroll: true }); }, 40);
  m.win.tabIndex = -1;
  window.dispatchEvent(new CustomEvent("inquire:window", { detail: { id, open: true } }));
  return m;
}
const WIN_VIEWS = {
  notes: () => openNotesWin(),
  achievements: () => window.InquireAchievements && InquireAchievements.open()
};
function openNotesWin(){
  const who = window.InquireUserName || window.InquireUser || "";
  const fresh = !MW.notes, m = modalWin("notes", { title: "My notes", cls: "mw-notes",
    sub: `All notes are saved on this computer${who ? ` for <b>${esc(who)}</b>` : ""}.` });
  if (!fresh) { m.cleanup.forEach(f => { try { f(); } catch(e){} }); m.cleanup = []; }
  renderNotes(m);
  return m;
}
function viewIn(el){
  if (!el) return;
  el.classList.remove("vt-in"); void el.offsetWidth; el.classList.add("vt-in");
  el.addEventListener("animationend", () => el.classList.remove("vt-in"), { once: true });
}
window.addEventListener("popstate", e => { if (e.state) go(e.state, false); });
window.addEventListener("hashchange", () => { const s = fromHash(); if (s) go(s, false); });
function fromHash(tok){
  const t = tok != null ? tok : (location.hash || "").slice(1);
  if (!t) return null;
  if (!t.startsWith("glossary") && t.includes("~")) {
    const i = t.indexOf("~"); let w = null; try { w = decodeURIComponent(t.slice(i + 1)).toLowerCase(); } catch(e){}
    const base = fromHash(t.slice(0, i)); return base && base.view === "math" ? { ...base, gword: w && GWORDS[w] ? w : null } : base;
  }
  if (NODE[t]) return { view: "math", field: fieldOf(t), topic: t };
  if (t === "field-map" || t.startsWith("field-map-")) { const sub = t.slice(10) || DB.defaultSubject; if (SM[sub]) return { view: "math", subject: sub, field: "map", topic: null }; }
  if (t.startsWith("field-")) { const f = t.slice(6); if (DB.fields[f]) return { view: "math", subject: subjOf(f), field: f, topic: null }; }
  if (t === "menu" || t === "dict" || t === "notes" || t === "achievements") return { view: t, topic: null };
  if (t === "glossary" || t.startsWith("glossary-") || t.startsWith("glossary~")) {
    const m = t.match(/^glossary(?:-([a-z0-9-]+))?(?:~(.*))?$/); if (!m) return null;
    let w = null; try { w = m[2] ? decodeURIComponent(m[2]).toLowerCase() : null; } catch(e){}
    return { view: "glossary", topic: null, g: { sub: m[1] && GSUB[m[1]] ? m[1] : "all", word: w && GWORDS[w] ? w : null, field: null } };
  }
  return null;
}

/* ---------- favourites + the top-bar progress meter ----------
   Star (☆/★) a subject (Dictionary card, navigator title) or a charted field (its tree header). The meter follows the
   tracked favourite on every screen (FAV.track; the first star becomes it), or "here" = the subject/field on screen.
   Stored per account in inqlaw.favs.<user> (inqlaw.favs._local with no sign-in). Plans can join as another source later. */
const favKey = () => "inqlaw.favs." + (window.InquireUser || "_local");
const loadFavs = () => { try { const v = JSON.parse(localStorage.getItem(favKey()) || "null"); if (v && Array.isArray(v.items)) return v; } catch(e){} return { items: [], track: null }; };
let FAV = loadFavs();
const saveFavs = () => { try { localStorage.setItem(favKey(), JSON.stringify(FAV)); } catch(e){} };
const favOk = k => typeof k === "string" && (k.startsWith("s:") ? !!SM[k.slice(2)] : k.startsWith("f:") ? !!DB.fields[k.slice(2)] && charted(k.slice(2)) : false);
const isFav = k => FAV.items.includes(k);
const favName = k => k.startsWith("s:") ? SM[k.slice(2)].name : DB.fields[k.slice(2)].name;
const favPool = k => k.startsWith("s:") ? NODES.filter(n => subjOf(n.field) === k.slice(2)) : fieldNodes(k.slice(2));
const favTracked = () => FAV.track && FAV.track !== "here" && favOk(FAV.track) && isFav(FAV.track) ? FAV.track : null;
function toggleFav(k){
  if (isFav(k)) { FAV.items = FAV.items.filter(x => x !== k); if (FAV.track === k) FAV.track = FAV.items.find(favOk) || null; }
  else { FAV.items.push(k); if (!FAV.track) FAV.track = k; }
  saveFavs(); crumbs();
}
function starBtn(k){
  const b = h("button", { type: "button", class: "fav" });
  const paint = () => { const on = isFav(k); b.classList.toggle("on", on); b.textContent = on ? "★" : "☆"; b.setAttribute("aria-pressed", String(on));
    b.title = (on ? "Remove " : "Add ") + favName(k) + (on ? " from favourites" : " to favourites (the progress bar can follow it)"); b.setAttribute("aria-label", b.title); };
  b.onclick = e => { e.stopPropagation(); e.preventDefault(); toggleFav(k); paint(); };
  paint(); return b;
}
function setMeter(text, frac, tracked){
  $("#stat-t").innerHTML = (tracked ? '<span class="stat-star" aria-hidden="true">★</span>' : "") + esc(text);
  $("#stat-m").style.width = Math.max(0, Math.min(1, frac)) * 100 + "%";
  const ts = $("#topstat"); if (ts) ts.classList.toggle("tracked", !!tracked);
}
function meter(text, frac){
  const k = favTracked();
  if (!k) return setMeter(text, frac, false);
  const pool = favPool(k), done = pool.filter(n => mastered.has(n.id)).length;
  setMeter(`${favName(k)} ${done}/${pool.length} mastered`, pool.length ? done / pool.length : 0, true);
}
function favMenu(){
  const old = document.querySelector(".fav-pop"); if (old) { old.remove(); return; }
  const ts = $("#topstat"), r = ts.getBoundingClientRect();
  const items = FAV.items.filter(favOk), cur = favTracked() || "here";
  const pop = h("div", { class: "fav-pop win", role: "dialog", "aria-label": "Progress bar" });
  pop.innerHTML = `<div class="win-h"><span class="dot"></span>Progress bar follows</div><div class="fav-list" role="radiogroup">
    ${[["here", "Where I am", "The subject or field on screen"], ...items.map(k => [k, favName(k), k.startsWith("s:") ? "Subject · all its fields" : SM[subjOf(k.slice(2))].name + " field"])]
      .map(([k, nm, sub]) => { const pool = k === "here" ? null : favPool(k), d = pool ? pool.filter(n => mastered.has(n.id)).length : 0;
        return `<button type="button" role="radio" class="fav-opt" data-k="${k}" aria-checked="${cur === k}"><span class="fav-ic">${k === "here" ? "⌖" : "★"}</span><span class="fav-nm">${esc(nm)}<small>${esc(sub)}</small></span>${pool ? `<span class="fav-n num">${d}/${pool.length}</span>` : ""}</button>`; }).join("")}
    </div><p class="fav-tip">${items.length ? "Plans will appear here too once they exist." : "Star a subject (☆ on its card or in its navigator) or a field (☆ beside its name) to follow it here."}</p>`;
  document.body.appendChild(pop);
  pop.style.top = r.bottom + 8 + "px"; pop.style.right = Math.max(8, window.innerWidth - r.right) + "px";
  const close = () => { pop.remove(); document.removeEventListener("pointerdown", out, true); document.removeEventListener("keydown", key, true); };
  const out = e => { if (!pop.contains(e.target) && !ts.contains(e.target)) close(); };
  const key = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); ts.focus(); } };
  document.addEventListener("pointerdown", out, true); document.addEventListener("keydown", key, true);
  pop.addEventListener("click", e => { const b = e.target.closest(".fav-opt"); if (!b) return; FAV.track = b.dataset.k; saveFavs(); crumbs(); close(); });
  const sel = pop.querySelector(`[aria-checked="true"]`); if (sel) sel.focus({ preventScroll: true });
}
{ const ts = $("#topstat"); if (ts) ts.onclick = favMenu; }
window.addEventListener("inquire:signed-in", () => { FAV = loadFavs(); });

/* ---------- top bar ---------- */
function crumbs(){
  const c = $("#crumbs"); c.innerHTML = "";
  const parts = [["Menu", () => go({ view: "menu", topic: null })]];
  if (S.view === "glossary") {
    parts.push(["Glossary", () => { G.sub = "all"; G.field = null; G.word = null; openGlossary({}); }]);
    if (G.sub !== "all") parts.push([gName(G.sub), null]);
    parts.forEach(([label, fn], i) => {
      if (i) c.appendChild(h("span", { class: "sep" }, "›"));
      if (fn && i < parts.length - 1) c.appendChild(h("button", { type: "button", onclick: fn }, esc(label)));
      else c.appendChild(h("span", { class: "here" }, esc(label)));
    });
    meter(`${Object.keys(GWORDS).length} words · ${gSubjects().length} subjects`, 0);
    return;
  }
  if (S.view === "notes") parts.push(["My notes", null]);
  else if (S.view !== "menu") parts.push(["Dictionary", () => go({ view: "dict", topic: null })]);
  if (S.view === "math") {
    parts.push([SM[S.subject].name, () => go({ view: "math", subject: S.subject, field: "map", topic: null })]);
    if (S.field !== "map") parts.push([DB.fields[S.field].name, () => go({ view: "math", topic: null })]);
    if (S.topic) parts.push([T[S.topic] ? T[S.topic].title : S.topic, S.gword ? () => go({ view: "math", topic: S.topic }) : null]);
    if (S.gword && GWORDS[S.gword]) parts.push([GWORDS[S.gword][0].w, null]);
  }
  parts.forEach(([label, fn], i) => {
    if (i) c.appendChild(h("span", { class: "sep" + (i < parts.length - 2 ? " hide-s" : "") }, "›"));
    if (fn && i < parts.length - 1) c.appendChild(h("button", { type: "button", class: i < parts.length - 2 ? "hide-s" : "", onclick: fn }, esc(label)));
    else c.appendChild(h("span", { class: "here" }, esc(label)));
  });
  const sf = S.topic ? fieldOf(S.topic) : (S.view === "math" && charted(S.field) ? S.field : null);
  const pool = sf ? fieldNodes(sf) : NODES.filter(n => subjOf(n.field) === S.subject);
  const done = pool.filter(n => mastered.has(n.id)).length, tot = pool.length;
  meter(`${sf ? DB.fields[sf].name : SM[S.subject].name} ${done}/${tot} mastered`, tot ? done / tot : 0);
}

function render(){
  clearView(); crumbs();
  if (S.view === "menu") renderMenu();
  else if (S.view === "dict") renderDict();
  else if (S.view === "glossary") renderGlossary();
  else renderWork();
  viewEl.focus({ preventScroll: true });
}

/* ---------- main menu ----------
   Top: the display box, a slow carousel of subjects with real lab screenshots (app/menu/*.jpg, inlined by build-web
   into window.InquireArt). Each slide opens its subject's field map; "All subjects" opens the Dictionary.
   Below: Games and Plans (uncharted) and the Glossary. Then the signed-in user's recent notes (web/src/notes.js). */
const MENU_SLIDES = (DB.menuSlides || []).filter(x => SM[x.sub]);
let menuTimer = null;
function renderMenu(){
  const s = h("div", { class: "screen" });
  s.innerHTML = `<div class="screen-in">
    <div class="hello"><p class="eyebrow">Inquire Law</p><h1>Main Menu</h1></div>
    <section class="mx win" aria-roledescription="carousel" aria-label="Subjects">
      <header class="win-h mx-h"><button type="button" class="btn-s mx-all" title="Open the Dictionary: every subject">◈ All subjects</button>
        <span class="mx-count num" aria-live="polite"></span></header>
      <div class="mx-stage"></div>
      <footer class="mx-foot"><button type="button" class="mx-arrow" data-d="-1" aria-label="Previous subject">◀</button><div class="mx-dots" role="tablist"></div><button type="button" class="mx-arrow" data-d="1" aria-label="Next subject">▶</button><span class="mx-bar"><i></i></span></footer>
    </section>
    <div class="slots four" id="slots"></div>
    <section class="mnotes" id="mnotes"></section>
    <div class="verline" id="verline"></div></div>`;
  viewEl.appendChild(s);
  const slots = $("#slots", s);
  if (window.inquireDesktop) {
    const vl = $("#verline", s);
    vl.innerHTML = `<span>Inquire Law <span class="num">v${esc(DESK_VERSION || "")}</span></span>`; // updates: Settings → About
  }
  $(".mx-all", s).onclick = () => go({ view: "dict", topic: null });
  menuCarousel($(".mx", s));
  slots.appendChild(h("div", { class: "slot big locked", "aria-disabled": "true" },
    `<span class="glyph">◇</span><span><h3>Games</h3><p>Practice through play: timed drills, puzzles and challenges built from the topics you have mastered.</p></span><span class="tag">Uncharted</span>`));
  slots.appendChild(h("div", { class: "slot big locked", "aria-disabled": "true" },
    `<span class="glyph">⌖</span><span><h3>Plans</h3><p>Lay out a learning venture: pick goals, order the topics, set a pace and track the route to mastery.</p></span><span class="tag">Uncharted</span>`));
  { const AC = window.InquireAchievements, ap = AC ? AC.points() : 0, L = AC ? AC.list() : [], got = L.filter(x => x.earned).length;
    slots.appendChild(h("button", { type: "button", class: "slot big", id: "achslot", onclick: () => go({ view: "achievements", topic: null }) },
      `<span class="glyph">◆</span><span><h3>Achievements</h3><p>Earn Achievement Points for lessons, fields, quizzes, notes and more. <span class="ach-n">${got} of ${L.filter(x => !x.soon).length} earned.</span></p></span><span class="tag ach-tag num">◆ ${ap.toLocaleString("en-US")} AP</span>`)); }
  slots.appendChild(h("button", { type: "button", class: "slot big", onclick: () => { G.sub = "all"; G.field = null; G.word = null; G.ret = null; openGlossary({}); } },
    `<span class="glyph">Aa</span><span><h3>Glossary</h3><p>Every subject’s words in one place, with each subject’s meaning marked. ${Object.keys(GWORDS).length} words so far.</p></span><span class="tag">Online</span>`));
  menuNotes($("#mnotes", s));
}
function menuCarousel(box){
  const stage = $(".mx-stage", box), dots = $(".mx-dots", box), count = $(".mx-count", box), bar = $(".mx-bar i", box);
  const ART = window.InquireArt || {}, N = MENU_SLIDES.length;
  const reduce = () => document.documentElement.hasAttribute("data-reduce-motion") || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  MENU_SLIDES.forEach((x, i) => {
    const sub = DB.subjects.find(d => d.id === x.sub) || { name: SM[x.sub].name, glyph: "·" };
    const grp = (DB.subjectGroups || []).find(g => g.id === sub.group);
    const imgs = x.art.filter(a => ART[a]).map((a, k) => `<img class="mx-i mx-i${k}" src="${ART[a]}" alt="" loading="lazy" decoding="async">`).join("");
    const sl = h("button", { type: "button", class: "mx-slide", "data-accent": grp && grp.accent ? grp.accent : "", "aria-label": `Open ${sub.name}`, tabindex: i ? "-1" : "0",
      onclick: () => go({ view: "math", subject: x.sub, field: "map", topic: null }) },
      `<span class="mx-text"><span class="mx-kicker">${esc(x.kicker)}</span>
        <span class="mx-title"><span class="mx-glyph">${sub.glyph}</span>${esc(sub.name)}</span>
        <span class="mx-line">${esc(x.line)}</span>
        <span class="mx-tags">${x.tags.map(t => `<i>${esc(t)}</i>`).join("")}</span>
        <span class="mx-go">Open ${esc(sub.name)} ▸</span></span>
       <span class="mx-art n${Math.min(3, x.art.length)}">${imgs}<span class="mx-scan" aria-hidden="true"></span></span>`);
    stage.appendChild(sl);
    const d = h("button", { type: "button", role: "tab", class: "mx-dot", "aria-label": sub.name, onclick: () => { show(i); restart(); } }, `<span>${esc(sub.name)}</span>`);
    dots.appendChild(d);
  });
  let cur = -1, t0 = 0, raf = 0, paused = false; const DUR = 7000;
  function show(i){
    cur = (i + N) % N;
    [...stage.children].forEach((el, k) => { el.classList.toggle("on", k === cur); el.tabIndex = k === cur ? 0 : -1; el.setAttribute("aria-hidden", String(k !== cur)); });
    [...dots.children].forEach((el, k) => el.setAttribute("aria-selected", String(k === cur)));
    count.textContent = String(cur + 1).padStart(2, "0") + " / " + String(N).padStart(2, "0");
  }
  function restart(){ t0 = performance.now(); bar.style.width = "0%"; }
  function tick(now){
    raf = requestAnimationFrame(tick);
    if (paused || reduce() || document.hidden) { t0 = now - (parseFloat(bar.style.width) || 0) / 100 * DUR; return; }
    const p = (now - t0) / DUR;
    if (p >= 1) { show(cur + 1); restart(); return; }
    bar.style.width = (p * 100).toFixed(2) + "%";
  }
  box.querySelectorAll(".mx-arrow").forEach(b => b.onclick = () => { show(cur + +b.dataset.d); restart(); });
  box.addEventListener("pointerenter", () => paused = true); box.addEventListener("pointerleave", () => paused = false);
  box.addEventListener("focusin", () => paused = true); box.addEventListener("focusout", () => paused = false);
  box.addEventListener("keydown", e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); show(cur + (e.key === "ArrowRight" ? 1 : -1)); restart(); const on = $(".mx-slide.on", box); if (on) on.focus(); } });
  show(0); restart(); raf = requestAnimationFrame(tick);
  cleanup.push(() => cancelAnimationFrame(raf));
}
const when = ms => { const d = new Date(ms), now = new Date(); return d.toDateString() === now.toDateString() ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" }); };
function menuNotes(el){
  const NS = window.InquireNotes; if (!NS) { el.hidden = true; return; }
  const draw = () => {
    const all = NS.list(), top = all.slice(0, 3);
    // the whole top bar opens My notes (like "All subjects" on the display box); New note asks for a title first
    el.innerHTML = `<header class="mnotes-h" role="link" tabindex="0" title="Open My notes" aria-label="Open My notes (${all.length})"><h2>My notes</h2><span class="num">${all.length}</span><span class="mnotes-go" aria-hidden="true">Open ▸</span>
      <button type="button" class="btn-s mnotes-new" data-a="new">＋ New note</button></header>
      <div class="mnotes-list">${top.length ? top.map(n => `<button type="button" class="mnote" data-id="${n.id}"><span class="mnote-t">${esc(n.title)}</span><span class="mnote-b">${esc(n.body.slice(0, 160))}</span><span class="mnote-m">${n.src && n.src.title !== n.title ? esc(n.src.title) + " · " : ""}${when(n.updated)}</span></button>`).join("")
        : `<p class="mnotes-empty">No notes yet. Write one here, or open the <b>Assist</b> tab at the bottom right on any topic and choose <b>Note from this page</b>.</p>`}</div>`;
    $('[data-a="new"]', el).onclick = async e => {
      e.stopPropagation();
      const t = await askText({ title: "New note", label: "Note title", placeholder: "Untitled note", ok: "Create note", max: 140 });
      if (t == null) return;
      const n = NS.create({ title: t || "Untitled note" }); NOTES.sel = n.id; NOTES.folder = "all"; NOTES.q = ""; NOTES.subj = ""; go({ view: "notes", topic: null });
    };
    const hd = $(".mnotes-h", el), open = () => go({ view: "notes", topic: null });
    hd.onclick = e => { if (!e.target.closest("button")) open(); };
    hd.onkeydown = e => { if ((e.key === "Enter" || e.key === " ") && e.target === hd) { e.preventDefault(); open(); } };
    el.querySelectorAll(".mnote").forEach(b => b.onclick = () => { NOTES.sel = b.dataset.id; go({ view: "notes", topic: null }); });
  };
  draw();
  window.addEventListener("inquire:notes-changed", draw); cleanup.push(() => window.removeEventListener("inquire:notes-changed", draw));
}

/* ---------- My notes layout: fold the folders / notes columns (◀ ▶ tabs, like the navigator's) and drag the list's right edge to resize it ---------- */
function notesLayout(nb){
  const fold = store.get("nbfold", { f: false, l: false }), W0 = () => store.get("nbw", 0);
  const paint = () => {
    nb.classList.toggle("ffold", !!fold.f); nb.classList.toggle("lfold", !!fold.l);
    nb.querySelectorAll(".nb-fold").forEach(b => {
      const shut = !!fold[b.dataset.p], what = b.dataset.p === "f" ? "folders" : "notes list";
      b.innerHTML = `<span aria-hidden="true">${shut ? "▶" : "◀"}</span>`; b.title = (shut ? "Show the " : "Hide the ") + what; b.setAttribute("aria-label", b.title); b.setAttribute("aria-expanded", String(!shut));
    });
    const w = W0(); if (w) nb.style.setProperty("--nb-lw-user", w + "px"); else nb.style.removeProperty("--nb-lw-user");
    if (matchMedia("(min-width:861px)").matches) { $(".nb-folders", nb).inert = !!fold.f; $(".nb-list", nb).inert = !!fold.l; }
  };
  nb.querySelectorAll(".nb-fold").forEach(b => b.onclick = () => { fold[b.dataset.p] = !fold[b.dataset.p]; store.set("nbfold", fold); paint(); });
  const rz = $(".nb-rz", nb), list = $(".nb-list", nb);
  const lim = w => { const total = nb.offsetWidth, fw = $(".nb-folders", nb).offsetWidth; return Math.round(Math.max(180, Math.min(w, 620, total - fw - 340))); };
  const setW = w => { store.set("nbw", w ? lim(w) : 0); paint(); };
  rz.addEventListener("pointerdown", e => {
    if (e.button !== 0) return; e.preventDefault();
    const z = nb.getBoundingClientRect().width / nb.offsetWidth || 1, x0 = e.clientX, w0 = list.offsetWidth;
    rz.setPointerCapture(e.pointerId); nb.classList.add("rz");
    const move = ev => nb.style.setProperty("--nb-lw-user", lim(w0 + (ev.clientX - x0) / z) + "px");
    const up = () => { rz.removeEventListener("pointermove", move); rz.removeEventListener("pointerup", up); rz.removeEventListener("pointercancel", up); nb.classList.remove("rz"); store.set("nbw", list.offsetWidth); };
    rz.addEventListener("pointermove", move); rz.addEventListener("pointerup", up); rz.addEventListener("pointercancel", up);
  });
  rz.addEventListener("dblclick", () => setW(0));
  rz.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setW(list.offsetWidth + (e.key === "ArrowRight" ? 20 : -20)); }
    else if (e.key === "Home") { e.preventDefault(); setW(0); }
  });
  paint();
}

/* ---------- small dialog in the Settings style (the app behind fogs): askText({title, label, placeholder, value, ok, max}) → text | null ---------- */
function askText(o = {}){
  return new Promise(done => {
    document.querySelectorAll(".ask-ov").forEach(x => x.remove());
    const last = document.activeElement;
    const ov = h("div", { class: "ask-ov" }, `<form class="ask-win win" role="dialog" aria-modal="true" aria-labelledby="ask-t">
      <header class="set-h"><span class="dot"></span><h2 id="ask-t">${esc(o.title || "Name")}</h2><button type="button" class="set-x" data-x aria-label="Cancel">✕</button></header>
      <div class="ask-body"><label class="ask-l" for="ask-in">${esc(o.label || "Name")}</label>
        <input id="ask-in" class="ask-in" maxlength="${o.max || 140}" placeholder="${esc(o.placeholder || "")}" value="${esc(o.value || "")}" autocomplete="off">
        <div class="ask-btns"><button type="button" class="btn-s" data-x>Cancel</button><button type="submit" class="btn good">${esc(o.ok || "OK")}</button></div></div></form>`);
    document.body.appendChild(ov);
    requestAnimationFrame(() => document.body.classList.add("ask-open"));
    const inp = $(".ask-in", ov);
    const fin = v => { document.body.classList.remove("ask-open"); document.removeEventListener("keydown", key, true); ov.classList.add("out"); setTimeout(() => ov.remove(), 250); if (last && document.contains(last)) try { last.focus({ preventScroll: true }); } catch (e) {} done(v); };
    const key = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fin(null); } };
    document.addEventListener("keydown", key, true);
    ov.querySelectorAll("[data-x]").forEach(b => b.onclick = () => fin(null));
    ov.addEventListener("pointerdown", e => { if (e.target === ov) fin(null); });
    $("form", ov).onsubmit = e => { e.preventDefault(); fin(inp.value.trim()); };
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  });
}

/* ---------- notes screen (#notes) ---------- */
const NOTES = { sel: null, q: "", folder: "all", subj: "", sort: store.get("notesort", "mine"), favTop: store.get("notefavtop", true) };
// what a note can be linked to: a subject, a field or a lesson ("s:", "f:", "t:" keys)
const linkLabel = k => { const id = k.slice(2); return k[0] === "s" ? (SM[id] ? SM[id].name : id) : k[0] === "f" ? (DB.fields[id] ? DB.fields[id].name : id) : (T[id] ? T[id].title : id); };
const linkIcon = k => k[0] === "s" ? (SM[k.slice(2)] ? SM[k.slice(2)].glyph : "◇") : k[0] === "f" ? "⌗" : "▤";
const linkSubject = k => { const id = k.slice(2); return k[0] === "s" ? id : k[0] === "f" ? (DB.fields[id] ? subjOf(id) : "") : (NODE[id] ? subjOf(fieldOf(id)) : ""); };
const linkColour = k => gColour(linkSubject(k) || DB.defaultSubject); // icon colour = the subject group (STEM cyan, A&H magenta, Social lime), never the theme
const linkOk = k => typeof k === "string" && (k[0] === "s" ? !!SM[k.slice(2)] : k[0] === "f" ? !!DB.fields[k.slice(2)] : k[0] === "t" ? !!NODE[k.slice(2)] : false);
function linkTargets(){
  const out = [];
  Object.keys(SM).forEach(sb => out.push({ id: "s:" + sb, label: SM[sb].name, sub: "Subject", ic: SM[sb].glyph, col: linkColour("s:" + sb) }));
  Object.keys(DB.fields).filter(f => SM[subjOf(f)]).forEach(f => out.push({ id: "f:" + f, label: DB.fields[f].name, sub: SM[subjOf(f)].name + " · field" + (charted(f) ? "" : " (planned)"), ic: "⌗", col: linkColour("f:" + f) }));
  NODES.forEach(n => { if (T[n.id]) out.push({ id: "t:" + n.id, label: T[n.id].title, sub: DB.fields[n.field].name + " · lesson", ic: "▤", col: linkColour("t:" + n.id) }); });
  return out;
}
function openLink(k){
  const id = k.slice(2);
  if (k[0] === "s") go({ view: "math", subject: id, field: "map", topic: null });
  else if (k[0] === "f") go({ view: "math", subject: subjOf(id), field: id, topic: null });
  else go({ view: "math", topic: id });
}
function renderNotes(m){
  const NS = window.InquireNotes;
  const s = m.body;
  s.innerHTML = `    <div class="nb"><nav class="nb-folders" aria-label="Folders"></nav>
    <aside class="nb-list"><div class="nb-tools"><label class="search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search notes" aria-label="Search notes"></label><button type="button" class="btn-s" data-a="new">＋ New</button></div>
      <div class="nb-filter"><select class="nb-sort" aria-label="Order of notes"><option value="mine">My order</option><option value="recent">Recently edited</option></select><button type="button" class="nb-favtop" aria-pressed="false" title="Keep favourites at the top of the list">★ first</button><select class="nb-subj" aria-label="Show notes linked to a subject"></select></div><div class="nb-items" role="listbox" aria-label="Notes"></div></aside>
    <section class="nb-ed"></section>
    <button type="button" class="nb-fold" data-p="f"></button><button type="button" class="nb-fold" data-p="l"></button>
    <div class="nb-rz" role="separator" aria-orientation="vertical" tabindex="0" aria-label="Resize the notes list (drag, or ←/→; double-click resets)" title="Drag to resize the notes list · double-click resets"></div></div>`;
  notesLayout($(".nb", s));
  m.head.innerHTML = `<span class="mw-tip" tabindex="0" title="Drag notes into folders and folders into other folders, drag either up or down to put them in your own order, star the ones you use most, link them to subjects and lessons, and paste or drop photos and videos in. The ◀ tabs hide the folders or the list; drag the line beside the list to resize it. Select words and right-click to link them to another note." aria-label="Tips">?</span>`;
  const fold = $(".nb-folders", s), items = $(".nb-items", s), ed = $(".nb-ed", s), q = $('input[type="search"]', s), subjSel = $(".nb-subj", s), sortSel = $(".nb-sort", s);
  q.value = NOTES.q;
  q.oninput = () => { NOTES.q = q.value; drawList(); };
  subjSel.onchange = () => { NOTES.subj = subjSel.value; drawList(); };
  sortSel.value = NOTES.sort === "recent" ? "recent" : "mine";
  sortSel.onchange = () => { NOTES.sort = sortSel.value; store.set("notesort", NOTES.sort); drawList(); };
  const favTop = $(".nb-favtop", s), paintFavTop = () => { favTop.setAttribute("aria-pressed", String(!!NOTES.favTop)); favTop.title = NOTES.favTop ? "Favourites are kept at the top. Click to place them in your own order instead" : "Favourites follow your order. Click to keep them at the top"; };
  favTop.onclick = () => { NOTES.favTop = !NOTES.favTop; store.set("notefavtop", NOTES.favTop); paintFavTop(); drawList(); }; paintFavTop();
  const realFolder = () => NS.folders().some(f => f.id === NOTES.folder) ? NOTES.folder : null;
  $('[data-a="new"]', s).onclick = () => { flushEd(); const n = NS.create({ folder: realFolder(), fav: NOTES.folder === "fav", links: NOTES.subj ? ["s:" + NOTES.subj] : [] }); NOTES.sel = n.id; NOTES.q = q.value = ""; drawAll(true); };
  // a folder shows its own notes and the notes of every folder inside it
  let inSub = new Set();
  const inView = n => (NOTES.folder === "all" || (NOTES.folder === "fav" ? n.fav : NOTES.folder === "none" ? !n.folder : inSub.has(n.folder)))
    && (!NOTES.subj || n.links.some(k => linkSubject(k) === NOTES.subj));

  // drag and drop: notes onto folders (file them) or onto other notes (My order); folders onto folders (nest) or between them (reorder)
  let DRAG = null;
  const clearDrop = () => s.querySelectorAll(".drop,.drop-before,.drop-after").forEach(el => el.classList.remove("drop", "drop-before", "drop-after"));
  const closed = () => new Set(store.get("notefold", []));
  function drawFolders(){
    const all = NS.list(), fs = NS.folders(), shut = closed();
    if (!["all", "fav", "none"].includes(NOTES.folder) && !fs.some(f => f.id === NOTES.folder)) NOTES.folder = "all";
    inSub = ["all", "fav", "none"].includes(NOTES.folder) ? new Set() : NS.subtree(NOTES.folder);
    const kids = new Set(fs.map(f => f.parent).filter(Boolean));
    const count = id => { const sub = NS.subtree(id); return all.filter(n => sub.has(n.folder)).length; };
    const row = (id, ic, name, n, f) => `<div class="nb-fd${NOTES.folder === id ? " sel" : ""}${f ? " user" : ""}" data-f="${id}"${f ? ` draggable="true" style="--d:${f.depth}"` : ""}>${f && kids.has(id) ? `<button type="button" class="nb-fcar" data-car="${id}" aria-expanded="${!shut.has(id)}" aria-label="${shut.has(id) ? "Show" : "Hide"} folders in ${esc(name)}">${shut.has(id) ? "▸" : "▾"}</button>` : f ? `<span class="nb-fcar" aria-hidden="true">▹</span>` : ""}<button type="button" class="nb-fdb" data-f="${id}" aria-pressed="${NOTES.folder === id}"${f ? ` title="Drag onto another folder to put it inside; drag above or below a folder to reorder. Alt+↑/↓ also reorders."` : ""}>${f ? "" : `<span class="nb-fic">${ic}</span>`}<span class="nb-fnm">${esc(name)}</span><span class="nb-fn num">${n}</span></button>${f ? `<button type="button" class="nb-fx" data-sub="${id}" title="New folder inside" aria-label="New folder inside ${esc(name)}">＋</button><button type="button" class="nb-fx" data-ren="${id}" title="Rename folder" aria-label="Rename ${esc(name)}">✎</button><button type="button" class="nb-fx" data-del="${id}" title="Delete folder (its notes and folders move up a level)" aria-label="Delete ${esc(name)}">✕</button>` : ""}</div>`;
    // hide folders inside a collapsed folder
    const hidden = new Set(); fs.forEach(f => { if (f.parent && (hidden.has(f.parent) || shut.has(f.parent))) hidden.add(f.id); });
    fold.innerHTML = `<div class="nb-fh">Library</div>`
      + row("all", "▤", "All notes", all.length) + row("fav", "★", "Favourites", all.filter(n => n.fav).length) + row("none", "◌", "Unfiled", all.filter(n => !n.folder).length)
      + `<div class="nb-fh nb-ftop" data-top>Folders</div>` + fs.filter(f => !hidden.has(f.id)).map(f => row(f.id, kids.has(f.id) ? "" : "▹", f.name, count(f.id), f)).join("")
      + `<button type="button" class="nb-fadd" data-a="addf">＋ New folder</button>`;
    // pick, open/close, rename, delete
    fold.querySelectorAll(".nb-fdb").forEach(b => b.onclick = () => { NOTES.folder = b.dataset.f; drawFolders(); drawList(); });
    fold.querySelectorAll("[data-car]").forEach(b => b.onclick = e => { e.stopPropagation(); const c = closed(), id = b.dataset.car; c.has(id) ? c.delete(id) : c.add(id); store.set("notefold", [...c]); drawFolders(); });
    fold.querySelectorAll("[data-sub]").forEach(b => b.onclick = () => { const id = b.dataset.sub, c = closed(); c.delete(id); store.set("notefold", [...c]);
      const at = h("div", { class: "nb-fd user", style: `--d:${(fs.find(f => f.id === id) || {}).depth + 1 || 1}` }); b.closest(".nb-fd").after(at);
      nameBox(at, "", v => { const f = NS.addFolder(v, id); NOTES.folder = f.id; drawAll(); }); });
    fold.querySelectorAll("[data-ren]").forEach(b => b.onclick = () => nameBox(b.closest(".nb-fd"), NS.folders().find(f => f.id === b.dataset.ren).name, v => { NS.renameFolder(b.dataset.ren, v); drawAll(); }));
    fold.querySelectorAll("[data-del]").forEach(b => { let armed = 0; b.onclick = () => {
      if (!armed) { b.textContent = "Delete?"; b.classList.add("armed"); armed = setTimeout(() => { armed = 0; b.textContent = "✕"; b.classList.remove("armed"); }, 3000); return; }
      clearTimeout(armed); NS.removeFolder(b.dataset.del); if (NOTES.folder === b.dataset.del) NOTES.folder = "all"; drawAll(); }; });
    // keyboard: Alt+↑/↓ on a folder moves it among its siblings
    fold.querySelectorAll(".nb-fd.user .nb-fdb").forEach(b => b.addEventListener("keydown", e => {
      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return; e.preventDefault();
      const id = b.dataset.f, f = fs.find(x => x.id === id), sib = fs.filter(x => x.parent === f.parent).map(x => x.id), i = sib.indexOf(id);
      if (e.key === "ArrowUp" && i > 0) NS.moveFolder(id, f.parent, sib[i - 1]); else if (e.key === "ArrowDown" && i < sib.length - 1) NS.moveFolder(id, f.parent, sib[i + 2] || null); else return;
      drawFolders(); const nb = fold.querySelector(`.nb-fdb[data-f="${id}"]`); if (nb) nb.focus();
    }));
    fold.querySelectorAll(".nb-fd.user").forEach(d => {
      d.addEventListener("dragstart", e => { DRAG = { type: "folder", id: d.dataset.f }; e.dataTransfer.setData("text/x-folder", d.dataset.f); e.dataTransfer.effectAllowed = "move"; d.classList.add("dragging"); });
      d.addEventListener("dragend", () => { DRAG = null; d.classList.remove("dragging"); clearDrop(); });
    });
    $('[data-a="addf"]', fold).onclick = e => nameBox(e.target, "", v => { const f = NS.addFolder(v); NOTES.folder = f.id; drawAll(); });
  }
  // where a drag over the folder column would land: { el, how: "into" | "before" | "after" | "top", id }
  function folderDrop(e){
    if (!DRAG) return null;
    const top = e.target.closest("[data-top]");
    if (DRAG.type === "folder" && top) return { el: top, how: "top" };
    const d = e.target.closest(".nb-fd"); if (!d || !d.dataset.f) return null;
    const f = d.dataset.f;
    if (DRAG.type === "note") return f === "all" ? null : { el: d, how: "into", id: f };
    if (f === "fav") return null;
    if (f === "all" || f === "none") return { el: d, how: "top" };
    if (NS.subtree(DRAG.id).has(f)) return null; // not into itself or its own subfolders
    const r = d.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
    return { el: d, how: y < .28 ? "before" : y > .72 ? "after" : "into", id: f };
  }
  fold.addEventListener("dragover", e => {
    const t = folderDrop(e); clearDrop(); if (!t) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
    t.el.classList.add(t.how === "before" ? "drop-before" : t.how === "after" ? "drop-after" : "drop");
  });
  fold.addEventListener("dragleave", e => { if (!fold.contains(e.relatedTarget)) clearDrop(); });
  fold.addEventListener("drop", e => {
    const t = folderDrop(e); clearDrop(); if (!t) return; e.preventDefault();
    if (DRAG.type === "note") {
      if (t.id === "fav") NS.update(DRAG.id, { fav: true, quiet: true }); else NS.update(DRAG.id, { folder: t.id === "none" ? null : t.id, quiet: true });
    } else {
      const fs = NS.folders(), tf = fs.find(x => x.id === t.id);
      if (t.how === "top") NS.moveFolder(DRAG.id, null, null);
      else if (t.how === "into") { NS.moveFolder(DRAG.id, t.id, null); const c = closed(); c.delete(t.id); store.set("notefold", [...c]); }
      else if (t.how === "before") NS.moveFolder(DRAG.id, tf.parent, t.id);
      else { const sib = fs.filter(x => x.parent === tf.parent && x.id !== DRAG.id).map(x => x.id); NS.moveFolder(DRAG.id, tf.parent, sib[sib.indexOf(t.id) + 1] || null); }
    }
    DRAG = null; drawAll();
  });
  // inline name field (new folder / rename); Enter saves, Esc cancels
  function nameBox(at, val, done){
    const box = h("form", { class: "nb-fname" }, `<input maxlength="60" aria-label="Folder name" placeholder="Folder name" value="${esc(val)}"><button type="submit" class="btn-s">OK</button>`);
    at.replaceWith(box); const inp = $("input", box); inp.focus(); inp.select();
    let fin = false;
    const end = ok => { if (fin) return; fin = true; if (ok && inp.value.trim()) done(inp.value.trim()); else drawFolders(); };
    box.onsubmit = e => { e.preventDefault(); end(true); };
    inp.onkeydown = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); end(false); } };
    inp.onblur = () => setTimeout(() => end(true), 120);
  }
  function drawList(){
    const used = new Set(NS.list().flatMap(n => n.links.map(linkSubject)).filter(Boolean));
    if (NOTES.subj && !used.has(NOTES.subj)) NOTES.subj = "";
    subjSel.innerHTML = `<option value="">Linked to any subject</option>` + Object.keys(SM).filter(x => used.has(x)).map(x => `<option value="${x}"${NOTES.subj === x ? " selected" : ""}>Linked to ${esc(SM[x].name)}</option>`).join("");
    subjSel.hidden = !used.size;
    const mine = NOTES.sort !== "recent";
    const all = NS.list(NOTES.q).filter(inView).sort((a, b) => (NOTES.favTop ? b.fav - a.fav : 0) || (mine ? NS.byOrder(a, b) : b.updated - a.updated)); // favourites on top unless "★ first" is off
    if (!NOTES.sel || !all.some(n => n.id === NOTES.sel)) { if (!NOTES.sel || !NS.get(NOTES.sel) || !inView(NS.get(NOTES.sel))) NOTES.sel = all[0] ? all[0].id : null; }
    const fname = Object.fromEntries(NS.folders().map(f => [f.id, f.name]));
    items.innerHTML = all.length ? all.map(n => `<div role="option" tabindex="0" class="nb-it" draggable="true" aria-selected="${n.id === NOTES.sel}" data-id="${n.id}"><span class="nb-t">${n.fav ? '<i class="nb-star" aria-label="Favourite">★</i>' : ""}${esc(n.title)}</span><span class="nb-m">${n.folder && fname[n.folder] && NOTES.folder !== n.folder ? "▸ " + esc(fname[n.folder]) + " · " : ""}${n.links.filter(linkOk).slice(0, 2).map(k => esc(linkLabel(k))).join(", ")}${n.links.filter(linkOk).length ? " · " : ""}${when(n.updated)}</span></div>`).join("")
      : `<p class="nb-empty">${NOTES.q ? "No notes match." : NOTES.folder === "fav" ? "No favourites yet. Star a note with ☆." : "No notes here yet."}</p>`;
    items.querySelectorAll(".nb-it").forEach(b => {
      b.onclick = () => { if (NOTES.sel === b.dataset.id) return; flushEd(); NOTES.sel = b.dataset.id; drawList(); drawEd(); };
      b.addEventListener("dragstart", e => { DRAG = { type: "note", id: b.dataset.id }; e.dataTransfer.setData("text/x-note", b.dataset.id); e.dataTransfer.effectAllowed = "move"; b.classList.add("dragging"); });
      b.addEventListener("dragend", () => { DRAG = null; b.classList.remove("dragging"); clearDrop(); });
      // keyboard: Alt+↑/↓ moves the note in My order
      b.addEventListener("keydown", e => {
        if ((e.key === "Enter" || e.key === " ") && e.target === b) { e.preventDefault(); b.click(); return; }
        if (!mine || !e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return; e.preventDefault();
        const ids = all.map(n => n.id), i = ids.indexOf(b.dataset.id), j = i + (e.key === "ArrowUp" ? -1 : 1); if (j < 0 || j >= ids.length) return;
        ids.splice(i, 1); ids.splice(j, 0, b.dataset.id); reorder(ids); const nb = items.querySelector(`[data-id="${b.dataset.id}"]`); if (nb) nb.focus();
      });
    });
    items.title = mine ? "Drag notes up or down to reorder them, or onto a folder to file them" : "Choose My order to arrange notes by dragging";
    curIds = all.map(n => n.id);
  }
  // the notes on screen in their new order → fold them into the full My order (notes not on screen keep their places)
  let curIds = [];
  function reorder(ids){
    const full = NS.list().sort(NS.byOrder).map(n => n.id), shown = new Set(ids), slots = [];
    full.forEach((id, i) => { if (shown.has(id)) slots.push(i); });
    slots.forEach((i, k) => { full[i] = ids[k]; });
    NS.setOrder(full); drawList();
  }
  const noteDrop = e => {
    if (!DRAG || DRAG.type !== "note" || NOTES.sort === "recent") return null;
    const it = e.target.closest(".nb-it"); if (!it || it.dataset.id === DRAG.id) return null;
    const r = it.getBoundingClientRect(); return { el: it, after: e.clientY > r.top + r.height / 2 };
  };
  items.addEventListener("dragover", e => { const t = noteDrop(e); clearDrop(); if (!t) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; t.el.classList.add(t.after ? "drop-after" : "drop-before"); });
  items.addEventListener("dragleave", e => { if (!items.contains(e.relatedTarget)) clearDrop(); });
  items.addEventListener("drop", e => {
    const t = noteDrop(e); clearDrop(); if (!t) return; e.preventDefault();
    const ids = curIds.filter(id => id !== DRAG.id); let at = ids.indexOf(t.el.dataset.id); if (t.after) at++;
    ids.splice(at, 0, DRAG.id); DRAG = null; reorder(ids);
  });
  let saveT = null, rich = null;
  const flushEd = () => { if (rich) rich.flush(); if (saveT) { clearTimeout(saveT); saveT = null; const ti = $(".nb-title", ed); if (ti && ed.dataset.id && NS.get(ed.dataset.id)) NS.update(ed.dataset.id, { title: ti.value.trim() || "Untitled note" }); } };
  function drawEd(focusTitle){
    if (rich) { rich.destroy(); rich = null; }
    const n = NOTES.sel && NS.get(NOTES.sel);
    ed.dataset.id = n ? n.id : "";
    if (!n) { ed.innerHTML = `<div class="nb-none"><p>Select a note, or start a new one.</p></div>`; return; }
    const fs = NS.folders();
    ed.innerHTML = `<div class="nb-bar"><button type="button" class="nb-favb${n.fav ? " on" : ""}" data-a="fav" aria-pressed="${n.fav}" title="${n.fav ? "Remove from favourites" : "Add to favourites"}">${n.fav ? "★" : "☆"}</button>
        <label class="nb-fsel"><span>Folder</span><select data-a="folder" aria-label="Folder"><option value="">Unfiled</option>${fs.map(f => `<option value="${f.id}"${n.folder === f.id ? " selected" : ""}>${"\u00a0\u00a0\u00a0".repeat(f.depth)}${esc(f.name)}</option>`).join("")}</select></label>
        <span class="nb-saved" aria-live="polite" title="Last saved ${esc(new Date(n.updated).toLocaleString())}">Saved</span>
        <button type="button" class="btn-s" data-a="photo" title="Add photos from this computer (or paste / drop them into the note)">＋ Photo</button><button type="button" class="btn-s" data-a="purl" title="Show a photo from a web address">Photo link</button>
        <button type="button" class="btn-s" data-a="md">Save as .md</button><button type="button" class="btn-s set-warn" data-a="del">Delete</button></div>
      <form class="nb-urlrow" hidden><input type="url" placeholder="https://… address of a photo" aria-label="Photo address"><button type="submit" class="btn-s">Insert</button><button type="button" class="btn-s" data-a="purlx">Cancel</button><span class="nb-urlmsg"></span></form>
      <div class="nb-links"><span class="nb-lb">Linked to</span><span class="nb-chips"></span><button type="button" class="btn-s nb-ladd" data-a="link">＋ Link subject, field or lesson</button></div>
      <input class="nb-title" value="${esc(n.title)}" aria-label="Title" maxlength="140">
      <div class="nb-host"></div><input type="file" accept="image/*" multiple hidden>`;
    const ti = $(".nb-title", ed), sv = $(".nb-saved", ed), file = $('input[type="file"]', ed);
    rich = NS.mountEditor($(".nb-host", ed), n.id, {
      onEditing: () => { sv.textContent = "Editing…"; },
      onSaved: () => { sv.textContent = "Saved"; const it = items.querySelector(`[data-id="${n.id}"] .nb-m`); if (it) drawList(); },
      openNote: id => { NOTES.sel = id; const m = NS.get(id); if (m && !inView(m)) { NOTES.folder = "all"; NOTES.subj = ""; } drawAll(); },
      openTopic: id => go({ view: "math", topic: id })
    });
    ti.oninput = () => { clearTimeout(saveT); sv.textContent = "Editing…"; saveT = setTimeout(() => { saveT = null; NS.update(n.id, { title: ti.value.trim() || "Untitled note" }); sv.textContent = "Saved"; const it = items.querySelector(`[data-id="${n.id}"] .nb-t`); if (it) it.lastChild.textContent = ti.value.trim() || "Untitled note"; }, 400); };
    const chips = () => {
      const m = NS.get(n.id), ks = m.links.filter(linkOk);
      $(".nb-chips", ed).innerHTML = ks.length ? ks.map(k => `<span class="nb-chip"><button type="button" data-open="${k}" title="Open ${esc(linkLabel(k))}"><span class="nb-cic" style="color:${linkColour(k)}">${linkIcon(k)}</span>${esc(linkLabel(k))}</button><button type="button" class="nb-cx" data-x="${k}" aria-label="Remove link to ${esc(linkLabel(k))}">×</button></span>`).join("") : `<span class="nb-nolink">Nothing yet</span>`;
      $(".nb-chips", ed).querySelectorAll("[data-open]").forEach(b => b.onclick = () => { flushEd(); openLink(b.dataset.open); });
      $(".nb-chips", ed).querySelectorAll("[data-x]").forEach(b => b.onclick = () => { NS.unlink(n.id, b.dataset.x); chips(); drawList(); });
    };
    chips();
    $('[data-a="link"]', ed).onclick = async e => {
      const r = e.currentTarget.getBoundingClientRect(), have = new Set(NS.get(n.id).links);
      const k = await NS.pick({ x: r.left, y: r.bottom + 6, title: "Link this note to…", placeholder: "Search subjects, fields and lessons", items: linkTargets().filter(x => !have.has(x.id)) });
      if (k && typeof k === "string") { NS.link(n.id, k); chips(); drawList(); }
    };
    $('[data-a="fav"]', ed).onclick = e => { const m = NS.update(n.id, { fav: !NS.get(n.id).fav, quiet: true }); const b = e.currentTarget; b.classList.toggle("on", m.fav); b.textContent = m.fav ? "★" : "☆"; b.setAttribute("aria-pressed", String(m.fav)); b.title = m.fav ? "Remove from favourites" : "Add to favourites"; drawFolders(); drawList(); };
    $('[data-a="folder"]', ed).onchange = e => { NS.update(n.id, { folder: e.target.value || null, quiet: true }); drawFolders(); drawList(); };
    $('[data-a="photo"]', ed).onclick = () => file.click();
    file.onchange = async () => { const k = await rich.addFiles(file.files); sv.textContent = k ? (k === 1 ? "Added" : k + " added") : "Those files are not photos or videos"; file.value = ""; };
    const urlRow = $(".nb-urlrow", ed), urlIn = $("input", urlRow);
    $('[data-a="purl"]', ed).onclick = () => { urlRow.hidden = !urlRow.hidden; if (!urlRow.hidden) urlIn.focus(); };
    $('[data-a="purlx"]', ed).onclick = () => { urlRow.hidden = true; };
    urlRow.onsubmit = e => { e.preventDefault(); if (rich.addURL(urlIn.value)) { urlIn.value = ""; urlRow.hidden = true; } else $(".nb-urlmsg", urlRow).textContent = "Use an https:// address of an image."; };
    $('[data-a="md"]', ed).onclick = () => { flushEd(); const m = NS.get(n.id); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["# " + m.title + "\n\n" + m.body], { type: "text/markdown" })); a.download = (m.title.replace(/[^\w\- ]+/g, "").trim() || "note") + ".md"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
    // delete at once, with Undo in a message for 8 s (photos and videos are only removed once that time is up)
    $('[data-a="del"]', ed).onclick = () => { flushEd(); if (rich) { rich.destroy(); rich = null; } NOTES.sel = null; NS.deleteWithUndo(n.id, id => { if (s.isConnected) { NOTES.sel = id; drawAll(); } }); drawAll(); };
    if (focusTitle) { ti.focus(); ti.select(); }
  }
  function drawAll(focusTitle){ drawFolders(); drawList(); drawEd(focusTitle); }
  drawAll();
  m.cleanup.push(() => { flushEd(); if (rich) { rich.destroy(); rich = null; } });
}

/* ---------- dictionary ---------- */
function renderDict(){
  const s = h("div", { class: "screen" });
  s.innerHTML = `<div class="screen-in">
    <div class="hello"><div class="back-row"><button type="button" class="btn-s" id="dback">◀ Menu</button></div><p class="eyebrow">Dictionary</p><h1>Subjects</h1>
    <p>Pick a subject to open its navigator. Fields appear on the left and the selected field's skill tree on the right.</p></div>
    <div class="subj-groups" id="subj"></div></div>`;
  viewEl.appendChild(s);
  $("#dback", s).onclick = () => go({ view: "menu", topic: null });
  (DB.subjectGroups || [{ id: "all", name: "Subjects", line: "" }]).forEach(g => {
    const subs = DB.subjects.filter(x => (x.group || "all") === g.id).map((x, i) => [x, i]) // starred subjects first in their group, then the usual order
      .sort((a, b) => (isFav("s:" + b[0].id) - isFav("s:" + a[0].id)) || a[1] - b[1]).map(x => x[0]);
    if (!subs.length) return;
    const sec = h("section", { class: "subj-group", "data-accent": g.accent || "", "aria-label": g.name });
    sec.innerHTML = `<div class="subj-gh"><h2>${esc(g.name)}</h2><span class="ln">${esc(g.line || "")}</span><span class="n">${subs.length}</span></div><div class="slots"></div>`;
    subs.forEach(sub => {
      const open = sub.status === "open";
      const el = h(open ? "button" : "div", open ? { type: "button", class: "slot", onclick: () => go({ view: "math", subject: sub.id, field: "map", topic: null }) } : { class: "slot locked", "aria-disabled": "true" },
        `<span class="glyph">${sub.glyph}</span><span><h3>${esc(sub.name)}</h3><p>${esc(sub.note)}</p></span><span class="tag">${open ? "Open" : "Locked"}</span>`);
      if (open && SM[sub.id]) { const wrap = h("div", { class: "slot-wrap" }); wrap.append(el, starBtn("s:" + sub.id)); $(".slots", sec).appendChild(wrap); }
      else $(".slots", sec).appendChild(el);
    });
    $("#subj", s).appendChild(sec);
  });
  // starring or un-starring a subject moves its card at once (the other cards slide over)
  $("#subj", s).addEventListener("click", e => { if (!e.target.closest(".fav")) return; setTimeout(() => { if (S.view !== "dict") return; const y = viewEl.scrollTop; render(); viewEl.scrollTop = y; }, 0); }, true); // capture: the star stops the click
}

/* ---------- workspace ---------- */
function renderWork(){
  const w = h("div", { class: "work", "data-accent": SM[S.subject].accent || "" });
  const nav = h("aside", { class: "nav", "aria-label": SM[S.subject].name + " navigator" });
  const main = h("section", { class: "main" });
  // ◀/▶ tab on the sidebar's right edge: fold the sidebar away so the map, tree or lesson gets the full width (desktop)
  const fold = h("button", { type: "button", class: "nav-fold", "aria-controls": "navside" });
  nav.id = "navside";
  const setFold = (on, save) => {
    w.classList.toggle("navfold", on);
    nav.inert = on && matchMedia("(min-width:761px)").matches;
    fold.innerHTML = `<span aria-hidden="true">${on ? "▶" : "◀"}</span>`;
    fold.setAttribute("aria-expanded", String(!on));
    fold.title = fold.ariaLabel = on ? "Show the sidebar" : "Hide the sidebar (wider view)";
    fold.setAttribute("aria-label", fold.title);
    if (save) store.set("navfold", on);
  };
  fold.onclick = () => setFold(!w.classList.contains("navfold"), true);
  setFold(!!store.get("navfold", false), false);
  w.append(nav, main, fold); viewEl.appendChild(w);
  buildNav(nav, w);
  if (S.gword && GWORDS[S.gword]) renderWordPane(main);
  else if (S.topic) renderTopic(main);
  else if (S.field === "map") renderFieldMap(main);
  else if (charted(S.field)) renderFieldTree(main, S.field);
  else renderDossier(main);
}

function buildNav(nav, w){
  const gn = Object.keys(GWORDS).filter(k => GWORDS[k].some(e => e.subject === S.subject));
  const glMode = S.navMode === "glossary";
  // glossary scope: this subject's words (default) or every subject's
  const scope = () => (S.glScope === "all" || !gn.length) ? "all" : S.subject;
  // field sub-filter (Arithmetic, Pre-Algebra, …) inside this subject's words
  if (S.glField && subjOf(S.glField) !== S.subject) S.glField = null;
  const glFields = subjFields(S.subject).map(f => [f, GL.filter(e => e.subject === S.subject && e.field === f).length]).filter(x => x[1]);
  const fieldOn = () => scope() !== "all" && S.glField && glFields.some(x => x[0] === S.glField) ? S.glField : null;
  nav.innerHTML = `<div class="nav-top">
      <div class="nav-title"><span class="glyph">${SM[S.subject].glyph}</span><div><h2>${esc(SM[S.subject].name)}</h2><small>${subjFields(S.subject).length} fields · ${subjTrees(S.subject).length} charted</small></div></div>
      <label class="search"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke="#8B97AE" stroke-width="1.4"/><path d="M9.5 9.5 13 13" stroke="#8B97AE" stroke-width="1.4"/></svg>
      <input id="navq" type="text" placeholder="${glMode ? "Search words and definitions" : "Search fields and topics"}" aria-label="${glMode ? "Search the glossary" : "Search fields and topics"}"></label>
    </div><div class="nav-list" id="navlist"></div>
    <div class="nav-foot">${glMode ? "Pick a word to read it here. The full glossary has field, letter and mastered filters." : "Gold nodes are ready to study. Green nodes are mastered. Mark a topic mastered from its page."}</div>`;
  $(".nav-title", nav).appendChild(starBtn("s:" + S.subject));
  const list = $("#navlist", nav);
  const q = $("#navq", nav);
  const fromHere = () => ({ label: SM[S.subject].name + (S.topic && T[S.topic] ? " · " + T[S.topic].title : S.field !== "map" && DB.fields[S.field] ? " · " + DB.fields[S.field].name : ""), subject: S.subject, state: { view: "math", subject: S.subject, field: S.field, topic: S.topic } });
  const setMode = m => { S.navMode = m; buildNav(nav, w); };
  function tabs(){
    // Field map and Glossary switch what the sidebar lists
    list.appendChild(h("button", { type: "button", class: "item" + (!glMode && S.field === "map" && !S.topic && !S.gword ? " sel" : ""), onclick: () => {
        if (glMode) { setMode("fields"); if (S.gword) go({ view: "math" }); return; }
        w.classList.remove("navopen"); go({ view: "math", subject: S.subject, field: "map", topic: null }); } },
      `<span class="ic">⌗</span><span style="min-width:0"><span class="nm">Field map</span><span class="lv">${glMode ? "Back to fields and topics" : esc(SM[S.subject].mapLine)}</span></span><span class="st"></span>`));
    list.appendChild(h("button", { type: "button", class: "item gl-nav" + (glMode ? " sel" : ""), "aria-pressed": String(glMode), onclick: () => { if (!glMode) setMode("glossary"); } },
      `<span class="ic">Aa</span><span style="min-width:0"><span class="nm">Glossary</span><span class="lv">${gn.length ? `${gn.length} ${esc(SM[S.subject].name)} word${gn.length === 1 ? "" : "s"}` : "Words from every subject"}</span></span><span class="st"></span>`));
  }
  function buildWords(){
    const term = q.value.trim().toLowerCase();
    list.innerHTML = "";
    if (!term) tabs();
    const sc = scope();
    const tools = h("div", { class: "nav-gl-tools" });
    const all = Object.keys(GWORDS).length;
    tools.innerHTML = (gn.length ? [[S.subject, SM[S.subject].name, gGlyph(S.subject), gColour(S.subject), gn.length], ["all", "All subjects", "◎", "var(--line-2)", all]]
      .map(([id, nm, gl, c, n]) => `<button type="button" class="gl-chip sm" data-scope="${id}" aria-pressed="${sc === id}" style="--gc:${c}"><span class="g">${gl}</span>${esc(nm)}<span class="n">${n}</span></button>`).join("")
      : `<span class="nav-gl-none">No ${esc(SM[S.subject].name)} words yet. Showing every subject.</span>`)
      + (sc !== "all" && glFields.length > 1 ? `<div class="nav-gl-flds" role="group" aria-label="Filter by field"><span class="nav-gl-fl">Field</span>`
        + [["", "All fields", gn.length], ...glFields.map(([f, n]) => [f, DB.fields[f].name, n])]
          .map(([f, nm, n]) => `<button type="button" class="gl-chip sm nav-gl-fld" data-gfld="${f}" aria-pressed="${(fieldOn() || "") === f}" style="--gc:${gColour(S.subject)}">${esc(nm)}<span class="n">${n}</span></button>`).join("")
        + `</div>` : "")
      + `<button type="button" class="btn-s nav-gl-full" data-full>Full glossary ↗</button>`; // below every filter
    tools.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.scope) { S.glScope = b.dataset.scope === "all" ? "all" : null; buildWords(); if (S.gword) render(); return; }
      if (b.dataset.gfld != null) { S.glField = b.dataset.gfld || null; buildWords(); return; }
      if (b.dataset.full != null) { w.classList.remove("navopen"); openGlossary({ from: fromHere(), sub: sc, field: fieldOn(), word: S.gword && GWORDS[S.gword].some(e => sc === "all" || e.subject === sc) ? S.gword : null }); }
    });
    list.appendChild(tools);
    const fo = fieldOn();
    const vis = Object.keys(GWORDS).map(k => { const blocks = GWORDS[k].filter(e => (sc === "all" || e.subject === sc) && (!fo || e.field === fo)); return { k, blocks, score: blocks.length ? gScore(k, blocks, term) : 0 }; })
      .filter(x => x.score > 0).sort((a, b) => term ? b.score - a.score || a.k.localeCompare(b.k) : a.k.localeCompare(b.k));
    if (!vis.length) { list.appendChild(h("div", { class: "gl-empty" }, term ? "No words match." + (fo ? " Try All fields." : "") : "No words yet.")); return; }
    let letter = null, body = null;
    vis.forEach(({ k, blocks }) => {
      const l = term ? "" : k[0].toUpperCase();
      if (!body || l !== letter) { letter = l; const g = h("div", { class: "grp open nav-gl-grp" }); if (l) g.appendChild(h("div", { class: "grp-h nav-gl-l" }, esc(l))); body = h("div", { class: "grp-b" }); g.appendChild(body); list.appendChild(g); }
      const subs = [...new Set(blocks.map(e => e.subject))];
      body.appendChild(h("button", { type: "button", class: "item sub nav-gw" + (S.gword === k ? " sel" : ""), "data-gword": k, onclick: () => { w.classList.remove("navopen"); go({ view: "math", gword: k }); } },
        `<span class="ic" style="--gc:${gColour(subs[0])}">${gGlyph(subs[0])}</span><span class="nm">${esc(GWORDS[k][0].w)}</span><span class="st">${subs.length > 1 ? subs.slice(1).map(x => `<i style="--gc:${gColour(x)}" title="${esc(gName(x))}">${gGlyph(x)}</i>`).join("") : ""}</span>`));
    });
    const sel = list.querySelector(".item.sel.nav-gw");
    if (sel && !term) requestAnimationFrame(() => { const r = sel.getBoundingClientRect(), lr = list.getBoundingClientRect(); if (r.top < lr.top || r.bottom > lr.bottom) sel.scrollIntoView({ block: "center" }); });
  }
  function build(){
    const term = q.value.trim().toLowerCase();
    list.innerHTML = "";
    if (!term) tabs();
    if (term) {
      const hits = gn.filter(k => k.includes(term) || GWORDS[k].some(e => e.subject === S.subject && (e.forms || []).some(f => f.toLowerCase().includes(term)))).slice(0, 6);
      if (hits.length) {
        const grp = h("div", { class: "grp open" }), body = h("div", { class: "grp-b" });
        grp.appendChild(h("div", { class: "grp-h" }, `<span class="car"></span>Glossary<span class="n">${hits.length}</span>`));
        hits.forEach(k => body.appendChild(h("button", { type: "button", class: "item sub", onclick: () => { w.classList.remove("navopen"); S.navMode = "glossary"; go({ view: "math", gword: k }); } },
          `<span class="ic">Aa</span><span class="nm">${esc(GWORDS[k][0].w)}</span><span class="st"></span>`)));
        grp.appendChild(body); list.appendChild(grp);
      }
    }
    SM[S.subject].groups.forEach(g => {
      const ids = g.ids.filter(id => {
        if (!term) return true;
        const f = DB.fields[id];
        if (f.name.toLowerCase().includes(term)) return true;
        if (charted(id)) return fieldNodes(id).some(n => (T[n.id]?.title || "").toLowerCase().includes(term));
        return f.topics.some(t => t.toLowerCase().includes(term));
      });
      if (!ids.length) return;
      const open = term || S.openGroups.includes(g.name) || ids.includes(S.field);
      const grp = h("div", { class: "grp" + (open ? " open" : "") });
      const head = h("button", { type: "button", class: "grp-h", "aria-expanded": String(!!open) }, `<span class="car"></span>${esc(g.name)}<span class="n">${ids.length}</span>`);
      head.onclick = () => {
        const on = !grp.classList.contains("open"); grp.classList.toggle("open", on); head.setAttribute("aria-expanded", String(on));
        S.openGroups = on ? [...new Set([...S.openGroups, g.name])] : S.openGroups.filter(x => x !== g.name); store.set("groups", S.openGroups);
      };
      const body = h("div", { class: "grp-b" });
      ids.forEach(id => {
        const f = DB.fields[id];
        const isCh = charted(id);
        const it = h("button", { type: "button", class: "item" + (isCh ? " charted" : "") + (S.field === id && !S.topic ? " sel" : ""), onclick: () => { w.classList.remove("navopen"); go({ view: "math", field: id, topic: null }); } },
          `<span class="ic">${f.icon}</span><span style="min-width:0"><span class="nm">${esc(f.name)}</span><span class="lv">${esc(f.level)}</span></span><span class="st">${isCh ? (fieldNodes(id).length ? doneIn(id) + "/" + fieldNodes(id).length : "Mapped") : "Planned"}</span>`);
        body.appendChild(it);
        if (isCh && (S.field === id || term)) {
          ORDERS[id].map(x => NODE[x]).forEach(n => {
            const t = T[n.id]; if (!t) return;
            if (term && !t.title.toLowerCase().includes(term)) return;
            const st = stateOf(n.id);
            const sub = h("button", { type: "button", class: "item sub" + (st === "mastered" ? " mastered" : "") + (S.topic === n.id ? " sel" : ""), onclick: () => { w.classList.remove("navopen"); go({ view: "math", field: id, topic: n.id }); } },
              `<span class="ic"${[...n.icon].length > 3 ? ' style="font-size:8px;letter-spacing:-.03em"' : [...n.icon].length > 2 ? ' style="font-size:9.5px"' : ""}>${n.icon}</span><span class="nm">${esc(t.title)}</span><span class="st">${st === "mastered" ? "✓" : ""}</span>`);
            body.appendChild(sub);
          });
        }
      });
      grp.append(head, body); list.appendChild(grp);
    });
    const sel = list.querySelector(".item.sel");
    if (sel && !term) requestAnimationFrame(() => { const r = sel.getBoundingClientRect(), lr = list.getBoundingClientRect(); if (r.top < lr.top || r.bottom > lr.bottom) sel.scrollIntoView({ block: "center" }); });
  }
  q.addEventListener("input", glMode ? buildWords : build);
  (glMode ? buildWords : build)();
}

/* ---------- generic pannable tree (Civ-style) ---------- */
const COLW = 364, ROWH = 92, PADX = 40, PADY = 58, NW = 312, NH = 70;
function buildTree(main, cfg){
  const { nodes, eras, key, stateFn, title, onOpen, infoFn } = cfg;
  const maxCol = Math.max(...nodes.map(n => n.col)), maxRow = Math.max(...nodes.map(n => n.row));
  const W = PADX * 2 + (maxCol + 1) * COLW - (COLW - NW), H = PADY + (maxRow + 1) * ROWH + 10;
  const vp = h("div", { class: "tree-vp", role: "region", "aria-label": title + " skill tree. Drag or scroll to pan." });
  const cv = h("div", { class: "tree-canvas" });
  cv.style.width = W + "px"; cv.style.height = H + "px";
  // eras
  const erasEl = h("div", { class: "eras" }); erasEl.style.width = W + "px";
  eras.forEach((e, i) => {
    const x0 = i === 0 ? 0 : PADX + e.from * COLW - (COLW - NW) / 2;
    const x1 = i === eras.length - 1 ? W : PADX + (e.to + 1) * COLW - (COLW - NW) / 2;
    const el = h("div", { class: "era" }, esc(e.name)); el.style.width = (x1 - x0) + "px"; erasEl.appendChild(el);
    const band = h("div", { class: "era-band" }); band.style.left = x0 + "px"; band.style.width = (x1 - x0) + "px"; cv.appendChild(band);
  });
  const pos = id => { const n = nodes.find(x => x.id === id); return { x: PADX + n.col * COLW, y: PADY + n.row * ROWH }; };
  // edges
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg"); svg.setAttribute("width", W); svg.setAttribute("height", H);
  const edges = [];
  nodes.forEach(n => n.pre.forEach(p => {
    const a = pos(p), b = pos(n.id);
    const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x + 22, y2 = b.y + NH / 2;
    const xm = x2 - 26;
    const r = Math.min(8, Math.abs(y2 - y1) / 2);
    let d;
    if (Math.abs(y2 - y1) < 1) d = `M${x1} ${y1}H${x2}`;
    else { const s = y2 > y1 ? 1 : -1; d = `M${x1} ${y1}H${xm - r}Q${xm} ${y1} ${xm} ${y1 + s*r}V${y2 - s*r}Q${xm} ${y2} ${xm + r} ${y2}H${x2}`; }
    const path = document.createElementNS(svgNS, "path"); path.setAttribute("d", d); path.setAttribute("class", "edge");
    svg.appendChild(path); edges.push({ from: p, to: n.id, el: path });
  }));
  cv.appendChild(svg);
  // nodes
  const els = {};
  nodes.forEach(n => {
    const p = pos(n.id), st = stateFn(n.id);
    const el = h("button", { type: "button", class: "node", "data-st": st, "data-id": n.id, "aria-label": n.label + " (" + ({mastered:"mastered",avail:"ready to study",locked:"prerequisites not yet mastered",planned:"planned"}[st]) + ")" },
      `<span class="box"><span class="ttl"><span>${esc(n.label)}</span><span class="hrs">${n.right || ""}</span></span><span class="chips">${(n.chips||[]).map(c => `<span class="chip">${c}</span>`).join("")}</span></span><span class="orb" style="font-size:${[...n.icon].length > 5 ? 12 : [...n.icon].length > 3 ? 14 : [...n.icon].length > 2 ? 17 : 20}px">${n.icon}</span>`);
    el.style.left = p.x + "px"; el.style.top = p.y + "px";
    els[n.id] = el; cv.appendChild(el);
  });
  edges.forEach(e => { if (stateFn(e.from) === "mastered" && stateFn(e.to) === "mastered") e.el.classList.add("done"); });
  vp.appendChild(cv); vp.appendChild(erasEl);
  const info = h("div", { class: "info-card win" }); info.innerHTML = `<div class="in"></div>`; vp.appendChild(info);
  // highlight ancestry
  function ancestors(id, acc = new Set()){ const n = nodes.find(x => x.id === id); n.pre.forEach(p => { if (!acc.has(p)) { acc.add(p); ancestors(p, acc); } }); return acc; }
  function hl(id){
    Object.values(els).forEach(e => e.classList.remove("hl"));
    edges.forEach(e => e.el.classList.remove("hl"));
    if (!id) { info.classList.remove("on"); return; }
    const anc = ancestors(id); anc.forEach(a => els[a].classList.add("hl"));
    edges.forEach(e => { if ((e.to === id || anc.has(e.to)) && (anc.has(e.from))) e.el.classList.add("hl"); });
    if (infoFn) { info.firstChild.innerHTML = infoFn(id, anc); info.classList.add("on"); }
  }
  // bottom bar
  const bar = h("div", { class: "tree-bar" });
  bar.innerHTML = `<button type="button" class="btn-s" data-d="-1" aria-label="Pan left">◀</button><div class="track" aria-hidden="true"><div class="thumb"></div></div><button type="button" class="btn-s" data-d="1" aria-label="Pan right">▶</button><span class="hint">Drag to pan · scroll · click a node to open</span>`;
  main.append(vp, bar);
  // pan logic
  let px = S.pan[key]?.x ?? 0, py = S.pan[key]?.y ?? 0, vw = 1, vh = 1;
  const track = $(".track", bar), thumb = $(".thumb", bar);
  function clamp(){ px = Math.min(0, Math.max(px, Math.min(0, vw - W))); if (H <= vh) py = Math.round((vh - H) / 2); else py = Math.min(0, Math.max(py, vh - H)); }
  function apply(){
    clamp(); cv.style.transform = `translate(${px}px,${py}px)`; erasEl.style.transform = `translateX(${px}px)`;
    const tw = track.clientWidth, frac = Math.min(1, vw / W);
    thumb.style.width = Math.max(24, tw * frac) + "px";
    const maxT = tw - thumb.offsetWidth; const t = W > vw ? (-px) / (W - vw) : 0;
    thumb.style.left = (maxT * t) + "px";
    S.pan[key] = { x: px, y: py };
  }
  const ro = new ResizeObserver(() => { vw = vp.clientWidth; vh = vp.clientHeight; apply(); });
  ro.observe(vp); cleanup.push(() => ro.disconnect());
  let drag = null, moved = false;
  vp.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, px, py, id: e.pointerId }; moved = false;
  });
  vp.addEventListener("pointermove", e => {
    if (!drag) {
      const n = e.target.closest(".node"); hl(n ? n.dataset.id : null); return;
    }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) > 5) { moved = true; vp.classList.add("drag"); try { vp.setPointerCapture(drag.id); } catch(_){} hl(null); }
    if (moved) { px = drag.px + dx; py = drag.py + dy; apply(); }
  });
  const end = e => {
    if (!drag) return;
    const wasMoved = moved; drag = null; vp.classList.remove("drag");
    if (!wasMoved) { const n = e.target.closest && e.target.closest(".node"); if (n) onOpen(n.dataset.id); }
  };
  vp.addEventListener("pointerup", end);
  vp.addEventListener("pointercancel", () => { drag = null; vp.classList.remove("drag"); });
  vp.addEventListener("pointerleave", () => { if (!drag) hl(null); });
  vp.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.classList.contains("node")) { e.preventDefault(); onOpen(e.target.dataset.id); } });
  cv.querySelectorAll(".node").forEach(n => { n.addEventListener("click", e => e.preventDefault()); n.addEventListener("focus", () => { hl(n.dataset.id); const x = parseFloat(n.style.left); if (x + px < 0 || x + px + NW > vw) { px = -(x - vw / 2 + NW / 2); apply(); } }); n.addEventListener("blur", () => hl(null)); });
  vp.addEventListener("wheel", e => { e.preventDefault(); const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || H <= vh) px -= d; else { px -= d; } apply(); }, { passive: false });
  bar.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { const target = px - (+b.dataset.d) * COLW * 2; animatePan(target); });
  function animatePan(target){ const start = px, t0 = performance.now(); const step = now => { const k = Math.min(1, (now - t0) / 350); const e = 1 - Math.pow(1 - k, 3); px = start + (target - start) * e; apply(); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
  let tdrag = null;
  thumb.addEventListener("pointerdown", e => { e.stopPropagation(); tdrag = { x: e.clientX, left: thumb.offsetLeft }; thumb.setPointerCapture(e.pointerId); });
  thumb.addEventListener("pointermove", e => { if (!tdrag) return; const maxT = track.clientWidth - thumb.offsetWidth; const l = Math.max(0, Math.min(maxT, tdrag.left + e.clientX - tdrag.x)); px = -(l / (maxT || 1)) * (W - vw); apply(); });
  thumb.addEventListener("pointerup", () => tdrag = null);
  track.addEventListener("pointerdown", e => { if (e.target !== track) return; const r = track.getBoundingClientRect(); const t = (e.clientX - r.left) / r.width; animatePan(-(t * W - vw / 2)); });
  return { els, focus(id){ const p = pos(id); px = -(p.x - vw / 2 + NW / 2); py = -(p.y - vh / 2 + NH / 2); apply(); els[id].classList.add("sel"); } };
}

function renderFieldTree(main, f){
  const F = DB.fields[f], TR = TREES[f], FN = fieldNodes(f);
  const head = h("div", { class: "tree-head" });
  const done = doneIn(f);
  const hrs = FN.reduce((s, n) => s + (T[n.id]?.hours || 0), 0);
  head.innerHTML = `<button type="button" class="btn-s navtoggle" id="navtoggle2">☰ Fields</button><button type="button" class="btn-s" id="tback">◀ ${esc(SM[subjOf(f)].name)} field map</button><div><h2>${esc(F.name)}</h2><div class="sub">${FN.length ? `${FN.length} topic${FN.length === 1 ? "" : "s"}${TR.planned && TR.planned.length ? ` written, ${TR.planned.length} planned` : ""} · about ${hrs} study hours · ${done} mastered` : `${(TR.planned || []).length} planned topics · the tree is mapped and the pages are being written`}</div></div>
   <div class="legend-chips"><span><i class="lg-m"></i>Mastered</span><span><i class="lg-a"></i>Ready</span><span><i class="lg-l"></i>Locked</span>${TR.planned && TR.planned.length ? '<span><i class="lg-p"></i>Planned</span>' : ""}<span><i class="lg-s"></i>Last opened</span></div>`;
  main.appendChild(head);
  $("h2", head).appendChild(starBtn("f:" + f));
  $("#navtoggle2", head).onclick = () => main.parentElement.classList.toggle("navopen");
  $("#tback", head).onclick = () => go({ view: "math", subject: subjOf(f), field: "map", topic: null });
  const inTree = new Set(FN.map(n => n.id));
  // Planned nodes (TR.planned) show the rest of a partly written tree, dashed and not openable.
  const PL = TR.planned || [], PLAN = Object.fromEntries(PL.map(n => [n.id, n]));
  const nodes = FN.map(n => ({ ...n, pre: n.pre.filter(p => inTree.has(p)), ext: n.pre.filter(p => !inTree.has(p)), label: T[n.id]?.title || n.id, right: T[n.id] ? T[n.id].hours + " h" : "" }))
    .concat(PL.map(n => ({ ...n, pre: n.pre.filter(p => inTree.has(p) || PLAN[p]), ext: n.pre.filter(p => !inTree.has(p) && !PLAN[p]), right: "Planned" })));
  const tree = buildTree(main, {
    nodes, eras: TR.eras, key: "tree-" + f, title: F.name, stateFn: id => PLAN[id] ? "planned" : stateOf(id),
    onOpen: id => { if (!PLAN[id]) go({ view: "math", field: f, topic: id }); },
    infoFn: (id, anc) => {
      if (PLAN[id]) { const lb = p => esc(PLAN[p] ? PLAN[p].label : (T[p]?.title || p));
        return `<div><span class="pill l">Planned</span></div><h4>${esc(PLAN[id].label)}</h4><p>This topic's page is not written yet. It is shown so you can see the whole path.</p><div class="req">${PLAN[id].pre.length ? "Requires: " + PLAN[id].pre.map(lb).join(", ") : ""}</div>`; }
      const t = T[id], st = stateOf(id), nd = NODE[id];
      const pill = st === "mastered" ? `<span class="pill m">Mastered</span>` : st === "avail" ? `<span class="pill a">Ready to study</span>` : `<span class="pill l">Locked</span>`;
      const nm = p => esc(T[p]?.title || p) + (NODE[p].field !== f ? ` <span style="color:var(--faint)">(${esc(DB.fields[NODE[p].field].name)})</span>` : "");
      const need = nd.pre.filter(p => !mastered.has(p)).map(nm);
      return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${pill}<span class="pill l">${esc(t?.grade || "")}</span></div><h4>${esc(t?.title || id)}</h4><p>${esc(t?.short || "")}</p>
        <div class="req">${nd.pre.length ? "Requires: " + nd.pre.map(nm).join(", ") : "Starting point, no prerequisites"}${need.length && st !== "mastered" ? "<br>Still to master: " + need.join(", ") : ""}<br>Path length: ${anc.size} topic${anc.size === 1 ? "" : "s"} before this one in this tree</div>`;
    }
  });
  const last = store.get("lastTopic." + f, f === DB.defaultField ? store.get("lastTopic", null) : null);
  if (last && inTree.has(last) && !S.pan["tree-" + f]) requestAnimationFrame(() => tree.focus(last));
  else if (last && inTree.has(last)) tree.els[last].classList.add("sel");
}

function renderFieldMap(main){
  const head = h("div", { class: "tree-head" });
  const sm = SM[S.subject];
  head.innerHTML = `<button type="button" class="btn-s navtoggle" id="navtoggle2">☰ Fields</button><button type="button" class="btn-s" id="mback">◀ Subjects</button><div><h2>${esc(sm.name)} field map</h2><div class="sub">${esc(sm.mapSub)}</div></div>
    <div class="legend-chips"><span><i class="lg-a"></i>Charted</span><span><i class="lg-l"></i>Planned</span></div>`;
  main.appendChild(head);
  $("#navtoggle2", head).onclick = () => main.parentElement.classList.toggle("navopen");
  $("#mback", head).onclick = () => go({ view: "dict", topic: null });
  const nodes = subjFields(S.subject).map(id => [id, DB.fields[id]]).map(([id, f]) => ({ id, col: f.col, row: f.row, pre: f.pre, icon: f.icon, label: f.name, right: "", chips: [f.level.split("·")[0].trim()] }));
  buildTree(main, {
    nodes, eras: sm.eras, key: "map-" + S.subject, title: sm.name + " field map",
    stateFn: id => charted(id) ? "avail" : "planned",
    onOpen: id => go({ view: "math", field: id, topic: null }),
    infoFn: id => { const f = DB.fields[id]; return `<div>${charted(id) ? '<span class="pill a">Charted</span>' : '<span class="pill l">Planned</span>'}</div><h4>${esc(f.name)}</h4><p>${esc(f.blurb)}</p><div class="req">${esc(f.level)}${f.pre.length ? "<br>Requires: " + f.pre.map(p => esc(DB.fields[p].name)).join(", ") : S.subject !== "mathematics" ? `<br>Starting field, no ${esc(sm.name)} prerequisites` : ""}${f.math && f.math.length ? "<br>Mathematics: " + f.math.map(p => esc(DB.fields[p].name)).join(", ") : ""}${f.physics && f.physics.length ? "<br>Physics: " + f.physics.map(p => esc(DB.fields[p].name)).join(", ") : ""}</div>`; }
  });
}

function renderDossier(main){
  const f = DB.fields[S.field];
  const id = S.field;
  const next = Object.entries(DB.fields).filter(([k, v]) => v.pre.includes(id)).map(([k]) => k);
  const d = h("div", { class: "dossier" });
  d.innerHTML = `<div class="dossier-in">
    <div><div class="back-row"><button type="button" class="btn-s navtoggle" id="navtoggle2">☰ Fields</button><button type="button" class="btn-s" id="fback">◀ ${esc(SM[subjOf(id)].name)} field map</button></div><p class="eyebrow">${esc(f.level)}</p><h1>${esc(f.name)}</h1><p class="lede">${esc(f.blurb)}</p>
      <div class="meta"><span class="pill l">Skill tree not yet charted</span>${subjTrees(subjOf(id)).length ? `<span class="pill a">${subjTrees(subjOf(id)).map(k => esc(DB.fields[k].name)).join(", ")} charted</span>` : ""}</div></div>
    <div class="dgrid">
      <div class="win"><div class="win-h"><span class="dot"></span>Core topics</div><div class="in"><ol>${f.topics.map(t => `<li>${esc(t)}</li>`).join("")}</ol></div></div>
      <div style="display:grid;gap:16px;align-content:start">
        <div class="win"><div class="win-h"><span class="dot"></span>Study first</div><div class="in"><div class="linkrow">${f.pre.length ? f.pre.map(p => `<button type="button" class="lnk ${charted(p) ? "charted" : ""}" data-f="${p}">${esc(DB.fields[p].name)}</button>`).join("") : '<span class="empty">None</span>'}</div></div></div>
        ${f.math && f.math.length ? `<div class="win"><div class="win-h"><span class="dot"></span>Mathematics needed</div><div class="in"><div class="linkrow">${f.math.map(p => `<button type="button" class="lnk ${charted(p) ? "charted" : ""}" data-f="${p}">${esc(DB.fields[p].name)}</button>`).join("")}</div></div></div>` : ""}
        ${f.physics && f.physics.length ? `<div class="win"><div class="win-h"><span class="dot"></span>Physics needed</div><div class="in"><div class="linkrow">${f.physics.map(p => `<button type="button" class="lnk ${charted(p) ? "charted" : ""}" data-f="${p}">${esc(DB.fields[p].name)}</button>`).join("")}</div></div></div>` : ""}
        <div class="win"><div class="win-h"><span class="dot"></span>Leads to</div><div class="in"><div class="linkrow">${next.length ? next.map(p => `<button type="button" class="lnk ${charted(p) ? "charted" : ""}" data-f="${p}">${esc(DB.fields[p].name)}</button>`).join("") : '<span class="empty">Capstone field in this map</span>'}</div></div></div>
        <div class="win"><div class="win-h"><span class="dot"></span>Status</div><div class="in"><p style="margin:0;color:var(--muted);font-size:14px">The topic tree for ${esc(f.name)} will be built with the same dossier format as the charted fields. The list on the left is the planned node set.</p></div></div>
      </div>
    </div></div>`;
  main.appendChild(d);
  d.querySelectorAll("[data-f]").forEach(b => b.onclick = () => go({ view: "math", field: b.dataset.f, topic: null }));
  $("#navtoggle2", d).onclick = () => main.parentElement.classList.toggle("navopen");
  $("#fback", d).onclick = () => go({ view: "math", subject: subjOf(id), field: "map", topic: null });
}

/* ---------- story panels (English topics) ---------- */
// A story: { title, book, author, year, kind, where, scene, focus: [tags], tokens, notes, note, tags? }.
// Focus words are coloured by their tag: parts of speech (DB.posTags) unless the story defines its own
// `tags` (subject/predicate, clause types, comma rules …). The art comes from DB.scenes.
function storyPassage(st){
  const P = st.tags || DB.posTags, focus = new Set(st.focus || []);
  let html = "<p>";
  DB.parseStory(st.tokens).forEach(x => {
    if (x.br) { html += "</p><p>"; return; }
    let w = esc(x.w); if (x.it) w = `<i>${w}</i>`;
    // a tagged word links only to a sense with the same part of speech (verb "work" ≠ noun "work")
    let gk = /[A-Za-z]/.test(x.w) ? gLookup(x.w) : null; const gp = !st.tags && x.tag && DB.posTags[x.tag] ? x.tag : null;
    if (gk && gp && !GWORDS[gk].some(e => e.pos === gp)) gk = null;
    const ga = gk ? ` data-gw="${esc(gk)}"${gp ? ` data-gp="${gp}"` : ""} tabindex="0" role="button" aria-label="${esc(x.w)}: open glossary card"` : "";
    if (x.tag && focus.has(x.tag)) { const note = (st.notes || {})[x.key]; w = `<span class="sw ${P[x.tag].c}${gk ? " gw" : ""}" title="${esc(P[x.tag].name + (note ? ": " + note : ""))}"${ga}>${w}</span>`; }
    else if (gk) w = `<span class="gw"${ga}>${w}</span>`;
    html += (x.glue ? "" : " ") + w;
  });
  return html + "</p>";
}
function storyPanel(st){
  const P = st.tags || DB.posTags, art = (DB.scenes || {})[st.scene] || "";
  const keys = [...new Set((st.focus || []).map(f => P[f].c + "|" + P[f].name))].map(k => { const [c, n] = k.split("|"); return `<span class="sk ${c}">${esc(n)}</span>`; }).join("");
  return `<article class="story">
    <header class="story-h"><h3>${esc(st.title)}</h3></header>
    <div class="story-art">${art}</div>
    <div class="story-txt">${storyPassage(st)}
      <div class="story-cite">${esc(st.author)} · <i>${esc(st.book)}</i> (${st.year}) · ${esc(st.where)}</div>
      <div class="story-note"><div class="story-keys">${keys}</div>${st.note}</div>
    </div>
  </article>`;
}

/* ---------- topic page ---------- */
// Placeholder used only if a node has no content yet (keeps the app usable while a tree is being written).
function stubTopic(id){
  return { title: id, short: "", grade: "", hours: 0, voice: "plain", eyebrow: "Content coming soon", hero: esc(id), lede: "This topic's dossier has not been written yet.",
    plain: "", formal: "", legend: [], steps: { title: "Steps", items: [] }, example: { prompt: "", lines: [], answer: "" }, why: "", careers: [], life: [], fields: [],
    prereqWhy: {}, unlocksWhy: {}, beyond: [], mistakes: [], practice: [], origin: "" };
}
/* Concept tab, blocks version (Counting first; docs/subjects/LAYERS.md → "Concept blocks"): a topic opts in with layers.concept.ideas.
   question → idea cards (each with a storyboard and a "Try it" chip that drives the lab) → what goes wrong → real scenes as tiles → history as a timeline. */
function conceptHTML(t, C, col){
  const chip = x => x && x.lab ? `<button type="button" class="dm-try" data-lab="${esc(x.lab)}"><span aria-hidden="true">▶</span>${esc(x.label)}</button>` : "";
  const q = C.question || { text: esc(t.title) };
  const hist = C.history ? `<details class="hist-more"><summary>Read the full story</summary><div class="lyr-hist">${C.history}</div>${(C.sources || []).length ? `<p class="lyr-src"><span>Sources</span>${C.sources.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join(" · ")}</p>` : ""}</details>` : "";
  return `
    ${cqHTML(q, "The question")}
    <div><h2>${esc(C.ideasTitle || "The big ideas")}</h2><div class="ideas">${C.ideas.map(x => `<div class="idea" style="--c:var(--${col(x.c || "c1")})"><h3>${esc(x.title)}${x.term ? `<span class="idea-term">${esc(x.term)}</span>` : ""}</h3>${x.demo ? `<div class="dm" data-spec="${esc(JSON.stringify(x.demo))}"></div>` : ""}<p>${x.text}</p>${chip(x.try)}</div>`).join("")}</div></div>
    ${C.walk ? walkHTML(C.walk) : ""}
    ${(C.timeline || []).length ? `<div class="c-hist"><h2>${esc(C.timelineTitle || "A short history")}</h2>${C.timelineLead ? `<p class="hist-lead">${C.timelineLead}</p>` : ""}<ol class="tl">${C.timeline.map(x => `<li><span class="tl-when">${esc(x.when)}</span><span class="tl-what">${x.what}</span></li>`).join("")}</ol>${hist}</div>` : ""}
    ${whyHTML(C.matters, C.stakes ? `<div class="stakes">${whyKey("Where it goes wrong", "red")}<h2>${esc(C.stakes.title)}</h2><p class="stakes-lead">${C.stakes.lead}</p><ul class="stakes-list">${C.stakes.items.map(x => `<li><b>${esc(x.role)}</b><span>${x.text}</span></li>`).join("")}</ul>${chip(C.stakes.try)}</div>` : "")}
    <div><h2>${esc(C.examplesTitle || "Where you will meet it")}</h2><div class="tiles">${(C.examples || []).map(c => `<details class="tile"><summary><span class="tile-fig">${esc(c.figure || "")}</span><span class="tile-role">${esc(c.role)}</span></summary><div class="tile-body"><p>${c.scene}</p>${c.takeaway ? `<p class="lyr-take">${esc(c.takeaway)}</p>` : ""}${chip(c.try)}</div></details>`).join("")}</div></div>`;
}
/* Concept "count it together": one continuous situation, a picture that follows each line (InquireDemo with still: true,
   line.frame = the frame to show), lines one at a time with predict questions ("Just show the line" skips one). */
function walkHTML(W){
  const L = W.lines, first = !(W.predict || [])[0];   // the first line shows on load unless it waits for a predict question
  return `<div id="c-walk" class="walk"><h2>${esc(W.title || "Work it together")}</h2>${W.lead ? `<p class="walk-lead">${W.lead}</p>` : ""}
    <div class="walk-grid"><div class="walk-l"><p class="tk-wk-h">The situation</p><div class="walk-in"><p class="walk-q">${W.prompt}</p>${W.demo ? `<div class="dm walk-dm" data-spec="${esc(JSON.stringify({ ...W.demo, still: true }))}"></div>` : ""}</div></div>
    <div class="tk-wk walk-wk" data-walk><p class="tk-wk-h">One step at a time</p>
      <div class="tbl"><table>${L.map((l, i) => `<tr class="wk-row"${i || !first ? " hidden" : ""}><td>${l.math}</td><td>${l.note || ""}</td></tr>`).join("")}</table></div>
      <div class="wk-ask" hidden></div>
      <div class="wk-bar"><button type="button" class="btn-s" data-wk-next>Show the first line</button><button type="button" class="btn-s ghost" data-wk-all>Show all</button><span class="wk-n">0 of ${L.length}</span></div>
      <div class="ans" hidden><b>Answer.</b> ${W.answer}</div></div></div></div>`;
}
// Shared by the Concept and Intermediate blocks: the big question/task with the lab's live number beside it, and the large-text "why" block.
function cqHTML(q, eyebrow, extra){
  const fig = q.figure, jump = (q.jump || []).length ? `<p class="cq-jump"><span>Jump to</span>${q.jump.map(j => `<button type="button" class="cq-go" data-jump="${esc(j.to)}">${esc(j.label)}</button>`).join("")}</p>` : "";
  return `<div class="cq win${fig ? "" : " nofig"}"><div class="win-h"><span class="dot"></span>${esc(eyebrow)}${fig && fig.echo ? `<span class="cq-live">Live from the model</span>` : ""}</div>
      <div class="cq-main"><h2>${esc(q.text)}</h2>${q.sub ? `<p>${q.sub}</p>` : ""}${extra || ""}${jump}</div>
      ${fig ? `<div class="cq-fig" aria-hidden="true"><div class="cq-num"${fig.echo ? ` data-echo="${esc(fig.echo)}" data-fb="${esc(fig.value)}"` : ""}>${esc(fig.echo ? echoText(LabKit.value(fig.echo), fig.value) : fig.value)}</div><div class="cq-cap"><span class="m c1">${fig.sym}</span> ${esc(fig.cap)}</div></div>` : ""}</div>`;
}
/* The "why" block in an Inquire Law console panel. With a second block (where it goes wrong) the two share the panel:
   side by side with a red rule between them (Concept), or stacked with the rule across (Formal, stack = true).
   Lesson order everywhere: what (question, ideas) → why → where it goes wrong (wrong vs right) → the rest. */
const whyKey = (label, tone) => `<div class="why-k${tone ? " " + tone : ""}"><i aria-hidden="true"></i>${esc(label)}</div>`;
const whyHTML = (M, where, stack) => !M && !where ? "" : `<section class="win why${M && where ? " why-pair" : ""}${stack ? " stack" : ""}">${M ? `<div class="matters">${whyKey("Why it matters")}<h2>${esc(M.title)}</h2>${M.text}</div>` : ""}${where || ""}</section>`;
/* Answer checker shared by the Intermediate and Formal blocks. k = {parts: [{label, ans}], hint} for typed numbers
   (commas, spaces and words ignored) or {choices: [{t, ok, why}], hint} for a pick. */
// Stable order for a pick: seeded by the question's text, so a learner sees the same order every visit.
function pzOrder(k){ const n = k.choices.length, idx = [...Array(n).keys()]; let h = 0; for (const ch of String(k.ask || k.q || "") + k.choices.map(c => c.t).join("|")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  for (let i = n - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; } return idx; }
function pzHTML(k){
  const order = k.choices ? pzOrder(k) : [];   // picks are shown in a stable shuffled order, so the right one is not always first
  const body = k.choices ? `<div class="pz-ch" role="group">${order.map(j => `<button type="button" class="pz-opt" data-j="${j}">${k.choices[j].t}</button>`).join("")}</div>`
    : `<form class="pz-form" novalidate>${k.parts.map((x, j) => `<label class="pz-in"><span>${esc(x.label)}</span><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-j="${j}" aria-label="${esc(x.label)}"></label>`).join("")}<button type="submit" class="btn-s good pz-check">Check</button></form>`;
  return `${body}<p class="pz-fb" aria-live="polite"></p>${k.hint ? `<p class="pz-hint" hidden><b>Hint.</b> ${k.hint}</p>` : ""}
    <div class="pz-acts">${k.hint ? `<button type="button" class="pz-link" data-pz-hint>Need a hint?</button>` : ""}<button type="button" class="pz-link" data-pz-show${k.showNow ? "" : " hidden"}>${esc(k.showLabel || "Show the worked answer")}</button></div>`;
}
let pzNudge = "";   // a lesson's own first "Not yet" (layers.nudge, set by layerHTML); a question's k.nudge wins
const pzNum = s => { const m = String(s).replace(/[,\s]/g, "").replace(/[\u2212\u2013]/g, "-").match(/-?\d+(\.\d+)?/);   // a typed − (U+2212) or – counts as a minus sign
   return m ? +m[0] : NaN; };
// Wires one checker inside c. o.right() after a right answer, o.show() when the learner asks for the answer.
function pzWire(c, k, o){
  const fb = c.querySelector(".pz-fb"), hint = c.querySelector(".pz-hint"), hb = c.querySelector("[data-pz-hint]"), show = c.querySelector("[data-pz-show]");
  let tries = 0, over = false;
  const showHint = () => { if (hint) hint.hidden = false; if (hb) hb.hidden = true; };
  const end = () => { over = true; if (hb) hb.hidden = true; show.hidden = true; };
  const verdict = (all, partial, why) => { tries++;
    window.dispatchEvent(new CustomEvent("inquire:quiz", { detail: { correct: all } }));
    if (all) { fb.textContent = k.right || o.rightText || "Correct."; fb.dataset.k = "ok"; end(); o.right(); return; }
    fb.textContent = why || (partial ? "One part is right. Check the other one." : tries === 1 ? (k.nudge || pzNudge || "Not yet. Check your work and try again.") : "Still off. Try the hint, or look at the answer.");
    fb.dataset.k = "no"; show.hidden = false; if (tries >= 2) showHint(); };
  const form = c.querySelector(".pz-form");
  if (form) form.onsubmit = e => { e.preventDefault(); if (over) return;
    const ins = [...form.querySelectorAll("input")]; if (ins.every(x => !x.value.trim())) { fb.textContent = "Type a number first."; fb.dataset.k = ""; return; }
    const ok = ins.map((x, j) => { const r = Math.abs(pzNum(x.value) - k.parts[j].ans) < 1e-9; x.dataset.ok = r ? "1" : "0"; return r; });
    if (ok.every(Boolean)) ins.forEach(x => x.readOnly = true);
    verdict(ok.every(Boolean), ok.length > 1 && ok.some(Boolean)); };
  c.querySelectorAll(".pz-opt").forEach(b => b.onclick = () => { if (over) return; const ch = k.choices[+b.dataset.j];
    b.dataset.ok = ch.ok ? "1" : "0"; if (ch.ok) c.querySelectorAll(".pz-opt").forEach(x => x.disabled = true); verdict(!!ch.ok, false, ch.ok ? "" : ch.why); });
  if (hb) hb.onclick = () => { showHint(); show.hidden = false; };
  show.onclick = () => { end(); o.show(); };
}
// Step goals (Intermediate): done when the lab reports the value (k.publish). Remembered per lesson while the app is open.
const goalDone = {};
function goalMet(g, v){ if (v === undefined) return false; const d = g.dataset; return d.eq !== undefined ? +v === +d.eq : +v >= +(d.min || 1); }
function goalTally(){ document.querySelectorAll("[data-goals]").forEach(w => { const gs = [...w.querySelectorAll(".goal")], n = gs.filter(g => g.classList.contains("done")).length, s = w.querySelector(".pz-sum b"); if (s) s.textContent = n;
  const md = w.querySelector(".moves-done"); if (md) md.hidden = n < gs.length; w.classList.toggle("moves-all", n === gs.length); gs.forEach((g, i) => { const b = w.querySelector(`.pz-bar [data-i="${i}"]`); if (b) b.dataset.s = g.classList.contains("done") ? "solved" : ""; }); }); }
function goalCheck(key, v){ let hit = false; document.querySelectorAll(`.goal[data-key="${key}"]:not(.done)`).forEach(g => { if (!goalMet(g, v)) return;
  g.classList.add("done"); g.querySelector(".goal-box").textContent = "✓"; const a = g.querySelector(".goal-after"); if (a) a.hidden = false; (goalDone[g.dataset.topic] = goalDone[g.dataset.topic] || new Set()).add(g.dataset.i); hit = true; }); if (hit) goalTally(); }
window.addEventListener("inquire:lab-value", e => goalCheck(e.detail.key, e.detail.value));
/* Intermediate tab, blocks version (Counting first; docs/subjects/LAYERS.md → "Intermediate blocks"): a topic opts in with layers.build.task.
   The task (live number, jump links) → key cards from the legend (with Try chips) → the method as a numbered rail (why + Try per step)
   → why a method matters (large text) → the worked example, one line at a time → everyday tasks as tiles. */
/* Intermediate "Everyday tasks". With build.exampleTask the worked example becomes the first task (open, its lines shown one at a time
   with the build.predict questions); every task may carry lines (a worked solution revealed line by line) and a demo (its own picture). */
function buildTasks(t){
  const B = t.layers.build, E = t.example, X = B.exampleTask, tasks = B.tasks || t.life.map(x => ({ task: x }));
  if (!X) return tasks;
  return [{ task: X.task, guided: true, check: { q: E.prompt, parts: X.parts, hint: X.hint }, lines: E.lines, predict: B.predict, tip: B.exampleTip, answer: E.answer, figure: X.figure, link: X.link, demo: X.demo, try: B.exampleTry }, ...tasks];
}
function buildHTML(t, B, col){
  const chip = x => x && x.lab ? `<button type="button" class="dm-try" data-lab="${esc(x.lab)}"><span aria-hidden="true">▶</span>${esc(x.label)}</button>` : "";
  const E = t.example, kt = B.keyTry || [], st = B.stepTry || [], sg = B.stepGoal || [], ng = sg.filter(Boolean).length, tasks = buildTasks(t), nt = tasks.filter(x => x.check).length;
  const bar = (n, label) => `<div class="pz-prog"><div class="pz-bar">${Array.from({ length: n }, (_, i) => `<span data-i="${i}"></span>`).join("")}</div><p class="pz-sum">${label} <b>0</b> of ${n}</p></div>`;
  let gi = 0;
  const goal = (g, i) => { const j = gi++; return `<div class="goal" data-key="${esc(g.key)}"${g.eq !== undefined ? ` data-eq="${g.eq}"` : ""}${g.min !== undefined ? ` data-min="${g.min}"` : ""} data-topic="${esc(S.topic || "")}" data-i="${j}">
      <span class="goal-box" aria-hidden="true">○</span><div><p class="goal-t"><span>Your move</span>${g.text}</p>${g.after ? `<p class="goal-after" hidden>${g.after}</p>` : ""}<div class="goal-acts"><button type="button" class="btn-s good goal-chk" data-goal-check>Check my move</button><button type="button" class="pz-link" data-to-lab>Go to the model ↑</button></div><p class="goal-fb" aria-live="polite"></p>${g.notYet ? `<template class="goal-ny">${g.notYet}</template>` : ""}</div></div>`; };
  const wkHTML = (lines, i) => !lines.length ? "" : `<div class="tk-wk" data-wk="${i}"><p class="tk-wk-h">Work it out line by line</p>
      <div class="tbl"><table>${lines.map(l => `<tr class="wk-row" hidden><td>${l.math}</td><td>${l.note || ""}</td></tr>`).join("")}</table></div>
      <div class="wk-ask" hidden></div>
      <div class="wk-bar"><button type="button" class="btn-s" data-wk-next>Show the first line</button><button type="button" class="btn-s ghost" data-wk-all>Show all</button><span class="wk-n">0 of ${lines.length}</span></div></div>`;
  const task = (x, i) => x.check ? `<details class="tile tk${x.guided ? " tk-ex" : ""}" data-tk="${i}" data-state="open"${x.guided ? " open" : ""}><summary><span class="tile-role tile-task">${esc(x.task)}</span><span class="pz-badge">${x.guided ? "Worked example · solve it" : "Solve it"}</span></summary>
      <div class="tile-body">${x.demo ? `<div class="dm tk-dm" data-spec="${esc(JSON.stringify({ ...x.demo, hold: true }))}"></div>` : ""}<p class="tk-q">${x.check.q}</p>${x.tip ? `<p class="wk-tip">${x.tip}</p>` : ""}
      <div class="tk-chk">${pzHTML({ ...x.check, showLabel: "Show the answer" })}</div>
      ${wkHTML(x.lines || [], i)}
      <div class="tk-after" hidden>${x.answer ? `<p class="tk-ans"><b>Answer.</b> ${x.answer}</p>` : ""}${x.figure ? `<p class="tile-fig">${esc(x.figure)}</p>` : ""}${x.link ? `<p>${x.link}</p>` : ""}${chip(x.try)}</div></div></details>`
    : `<details class="tile"><summary>${x.figure ? `<span class="tile-fig">${esc(x.figure)}</span>` : ""}<span class="tile-role tile-task">${esc(x.task)}</span></summary><div class="tile-body">${x.link ? `<p>${x.link}</p>` : ""}${chip(x.try)}</div></details>`;
  const merged = !!B.exampleTask || !!(t.layers.concept && t.layers.concept.walk);   // the worked example lives elsewhere
  return `
    ${cqHTML(B.task, "The task")}
    <div><h2>${esc(B.keysTitle || "Reading the model")}</h2>${B.intro || ""}<div class="ideas keys">${t.legend.map((k, i) => `<div class="idea" style="--c:var(--${col(k.c)})"><div class="key-sym m">${k.sym}</div><h3>${esc(k.name)}</h3><p>${k.desc}</p>${chip(kt[i])}</div>`).join("")}</div></div>
    <div id="b-method"${ng ? " data-goals" : ""}><h2>${esc(t.steps.title)}</h2>${ng ? `<div class="moves"><div class="moves-h"><span class="moves-k">Your moves</span>${bar(ng, "Moves done")}</div>${B.goalsIntro ? `<p class="prac-tip">${B.goalsIntro}</p>` : ""}<p class="moves-done" hidden>All ${ng} moves done ✓ You used every step of the method in the model.</p></div>` : ""}<ol class="method m2">${t.steps.items.map((s, i) => `<li><span class="method-n" aria-hidden="true">${i + 1}</span><div class="m-l"><p class="method-do">${s}</p></div><div class="m-r">${B.stepWhy && B.stepWhy[i] ? `<p class="method-why"><span>Why</span>${B.stepWhy[i]}</p>` : ""}${sg[i] ? goal(sg[i], i) : chip(st[i])}</div></li>`).join("")}</ol></div>
    ${whyHTML(B.matters)}
    ${merged ? "" : `<div id="b-example"><h2>${esc(B.exampleTitle || "Worked example")}</h2><div class="ex wk" data-wk="ex">
      <div class="prompt"><p class="eyebrow">Problem</p>${E.prompt}${B.exampleTip ? `<p class="wk-tip">${B.exampleTip}</p>` : ""}</div>
      <div class="tbl"><table>${E.lines.map((l, i) => `<tr class="wk-row"${i ? " hidden" : ""}><td>${l.math}</td><td>${esc(l.note || "")}</td></tr>`).join("")}</table></div>
      <div class="wk-ask" hidden></div>
      <div class="wk-bar"><button type="button" class="btn-s" data-wk-next>Show the next line</button><button type="button" class="btn-s ghost" data-wk-all>Show all</button><span class="wk-n">1 of ${E.lines.length}</span>${chip(B.exampleTry)}</div>
      <div class="ans" hidden><b>Answer.</b> ${E.answer}</div></div></div>`}
    <div id="b-tasks"${nt ? " data-tks" : ""}><h2>${esc(B.tasksTitle || "Everyday tasks")}</h2>${B.bridge || ""}${nt ? bar(nt, "Solved") : ""}<div class="tiles">${tasks.map(task).join("")}</div></div>`;
}
/* Formal tab, blocks version (Counting first; docs/subjects/LAYERS.md → "Formal blocks"): a topic opts in with layers.formal.question.
   The definition (live |A|, jump links) → vocabulary cards (everyday word → textbook term) → the formal statement → why exact words matter
   → writing a problem out (numbered rail with the math) → where formal answers go wrong → practice with a progress count. */
function formalHTML(t, F, col){
  const P = t.practice, K = F.checks || [];
  const def = (String(t.formal).match(/<div class="display">[\s\S]*?<\/div>/) || [""])[0];   // the boxed definition goes up into "The definition"
  const full = `<details class="hist-more f-full"><summary>${esc(F.statementTitle || "Read the formal statement in full")}</summary><span class="voice f">College level</span>${t.formal}</details>`;
  const card = (p, i) => { const k = K[i];
    if (!k) return `<div class="pq">${p.ctx ? `<p class="eyebrow lyr-ctx">${esc(p.ctx)}</p>` : ""}<div class="q"><span class="n">${String(i+1).padStart(2,"0")}</span>${p.q}</div><button type="button" class="btn-s" data-ans="${i}">Show answer</button><div class="a" hidden>${p.a}</div></div>`;
    return `<div class="pq pz" data-pz="${i}" data-state="open">
      <div class="pz-top">${p.ctx ? `<p class="eyebrow lyr-ctx">${esc(p.ctx)}</p>` : "<span></span>"}<span class="pz-badge">Unsolved</span></div>
      <div class="q"><span class="n">${String(i+1).padStart(2,"0")}</span>${p.q}</div>
      ${pzHTML(k)}
      <div class="a" hidden>${p.a}</div></div>`; };
  return `
    ${cqHTML(F.question, F.eyebrow || "The definition", def ? `<div class="f-def">${def}</div>` : "")}
    ${(F.vocab || []).length ? `<div id="f-vocab"><h2>${esc(F.vocabTitle || "The vocabulary")}</h2>${F.vocabIntro || ""}<div class="ideas vocab">${F.vocab.map(v => `<div class="idea" style="--c:var(--${col(v.c || "c1")})"><div class="key-sym m">${v.sym}</div><h3>${esc(v.term)}</h3><p>${v.def}</p>${v.was ? `<p class="voc-was"><span>You met it as</span>${v.was}</p>` : ""}</div>`).join("")}</div>${full}</div>` : `<div><h2>Formal statement</h2><span class="voice f">College level</span>${t.formal}</div>`}
    ${whyHTML(F.matters, `<div id="f-mist" class="stakes f-mist">${whyKey("Where it goes wrong", "red")}<h2>${esc(F.mistakesTitle || "Common mistakes")}</h2>${F.mistakesLead ? `<p class="stakes-lead">${F.mistakesLead}</p>` : ""}<div class="mist">${t.mistakes.map(m => `<div><div class="w">${m.wrong}</div><div class="f">${m.fix}</div></div>`).join("")}</div></div>`, true)}
    ${F.setup ? `<div id="f-setup"><h2>${esc(F.setup.title)}</h2>${F.setupIntro || ""}<ol class="method m2">${F.setup.items.map((x, i) => `<li><span class="method-n" aria-hidden="true">${i + 1}</span><div class="m-l"><p class="method-do">${x.say}</p></div><div class="m-r">${x.math ? `<div class="lyr-math">${x.math}</div>` : ""}</div></li>`).join("")}</ol></div>` : ""}
    <div id="f-prac"><h2>${esc(F.practiceTitle || "Your turn")}</h2>${F.practiceTip ? `<p class="prac-tip">${F.practiceTip}</p>` : ""}
      ${K.length ? `<div class="pz-prog" data-pz-prog><div class="pz-bar">${P.map((_, i) => `<span data-i="${i}"></span>`).join("")}</div><p class="pz-sum">Solved <b>0</b> of ${P.length}</p></div>` : ""}
      <div class="prac" data-pzs>${P.map(card).join("")}</div>
      ${K.length ? `<p class="pz-done" hidden>${F.practiceDone || `All ${P.length} solved. You can work these the formal way.`}</p>` : ""}</div>`;
}
/* Colour cues (Concept and Intermediate, Devon Oct 2026): the numbers of a situation glow amber (.hl-n) and its objects
   violet (.hl-o) (<mark> elements, so no "x span" rule restyles them), so the eye finds "what is counted" and "how many" first. Objects come from layers.concept.objects /
   layers.build.objects (word forms as written: "seat", "seats"); numbers are found automatically. Math (.m), inputs,
   pictures, headings' numerals in tiles and the live figures are left alone. Re-run on content drawn later (predict boxes). */
const HL_SKIP = "h2,label,.wk-q>span,.m,.math,svg,input,textarea,button,code,pre,.key-sym,.cq-num,.tile-fig,.tl-when,.pz-sum,.wk-n,.eyebrow,.why-k,.lyr-src,.idea-term,.tile-role,.pz-badge,.goal-t>span,.method-why>span,a,td:first-child,.hl-n,.hl-o,.lyr-tabs,template";
function hlText(root){
  const host = root && root.closest && root.closest("[data-hl]"); if (!host) return;
  const objs = JSON.parse(host.dataset.hl || "[]").map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(\\$?(?<![\\w.,])\\d[\\d,]*(?:\\.\\d+)?(?:st|nd|rd|th|%)?(?![\\w]))${objs.length ? `|\\b(${objs.join("|")})\\b` : ""}`, "gi");
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => !n.nodeValue.trim() || (n.parentElement && n.parentElement.closest(HL_SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodes = []; while (tw.nextNode()) nodes.push(tw.currentNode);
  nodes.forEach(n => { const t = n.nodeValue; re.lastIndex = 0; if (!re.test(t)) return; re.lastIndex = 0;
    const f = document.createDocumentFragment(); let i = 0, m;
    while ((m = re.exec(t))) { if (m.index > i) f.appendChild(document.createTextNode(t.slice(i, m.index)));
      const sp = document.createElement("mark"); sp.className = m[1] ? "hl-n" : "hl-o"; sp.textContent = m[0]; f.appendChild(sp); i = m.index + m[0].length; }
    if (i < t.length) f.appendChild(document.createTextNode(t.slice(i)));
    n.parentNode.replaceChild(f, n); });
}
/* A worked solution shown one line at a time. A line with a predict question waits for the learner (or "Just show the line").
   o.skip() when a line is shown without being predicted, o.end() once every line is out. Returns {all()} to reveal everything. */
function wireWk(w, PR, o){
  const rows = [...w.querySelectorAll(".wk-row")], n = w.querySelector(".wk-n"), nx = w.querySelector("[data-wk-next]"), al = w.querySelector("[data-wk-all]"), ans = w.querySelector(".ans"), ask = w.querySelector(".wk-ask");
  let ended = false;
  const upd = () => { const k = rows.filter(r => !r.hidden).length, done = k === rows.length; if (o.onShow) o.onShow(k); n.textContent = `${k} of ${rows.length}`; if (ans) ans.hidden = !done; al.hidden = done; nx.textContent = k ? "Show the next line" : "Show the first line";
    const q = done ? null : PR[k];
    if (q && ask && ask.dataset.i !== String(k)) { ask.dataset.i = k; ask.innerHTML = `<p class="wk-q"><span>Predict line ${k + 1}</span>${q.ask}</p>${pzHTML({ ...q, showLabel: "Just show the line", showNow: true })}`;
      hlText(ask); pzWire(ask, q, { rightText: q.right || "Right. Here is the line.", right: () => setTimeout(() => { rows[k].hidden = false; upd(); }, 650), show: () => { if (o.skip) o.skip(); rows[k].hidden = false; upd(); } }); }
    if (ask) ask.hidden = !q; nx.hidden = done || !!q;
    if (done && !ended) { ended = true; if (o.end) o.end(); } };
  nx.onclick = () => { const r = rows.find(r => r.hidden); if (r) r.hidden = false; upd(); };
  al.onclick = () => { if (o.skip) o.skip(); rows.forEach(r => r.hidden = false); upd(); };
  upd();
  return { all: () => { if (rows.some(r => r.hidden)) { rows.forEach(r => r.hidden = false); upd(); } } };
}
/* Brings the whole lab into view under the sticky topic bar (scrollIntoView alone left its top hidden behind the bar),
   then pings its outline. Used by Try-it chips and "Go to the model" buttons. */
function labIntoView(pg){
  const lab = pg.querySelector(".lab"); if (!lab) return;
  const bar = pg.querySelector(".topic-bar"), calm = document.documentElement.hasAttribute("data-reduce-motion") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  lab.style.scrollMarginTop = ((bar ? bar.offsetHeight : 0) + 16) + "px";
  lab.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  lab.classList.add("ping"); setTimeout(() => lab.classList.remove("ping"), 1200);
}
// Wires the Intermediate blocks after they are drawn: jump links and the one-line-at-a-time worked example.
function wireBlocks(body, pg, t){
  body.querySelectorAll("[data-jump]").forEach(b => b.onclick = () => { const el = body.querySelector("#" + b.dataset.jump); if (el) el.scrollIntoView({ behavior: document.documentElement.hasAttribute("data-reduce-motion") || matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); });
  const PRx = (t && t.layers && t.layers.build && t.layers.build.predict) || [];
  body.querySelectorAll('[data-wk="ex"]').forEach(w => wireWk(w, PRx, {}));
  const WK = t && t.layers && t.layers.concept && t.layers.concept.walk;
  body.querySelectorAll("[data-walk]").forEach(w => { const host = body.querySelector(".walk-dm"), F = WK.lines.map(l => l.frame);
    wireWk(w, WK.predict || [], { onShow: k => { const d = host && host._demo; if (d && d.goto) d.goto(k ? (F[k - 1] == null ? 0 : F[k - 1]) : 0); } }); });   // stand-alone worked example (lessons without build.exampleTask)
  body.querySelectorAll(".goal").forEach(g => { if ((goalDone[g.dataset.topic] || new Set()).has(g.dataset.i) || goalMet(g, LabKit.value(g.dataset.key))) { g.classList.add("done"); g.querySelector(".goal-box").textContent = "✓"; const a = g.querySelector(".goal-after"); if (a) a.hidden = false; (goalDone[g.dataset.topic] = goalDone[g.dataset.topic] || new Set()).add(g.dataset.i); } });
  body.querySelectorAll("[data-to-lab]").forEach(b => b.onclick = () => labIntoView(pg));
  body.querySelectorAll("[data-goal-check]").forEach(b => b.onclick = () => {   // "Check my move": confirms against what the model shows now
    const g = b.closest(".goal"), fb = g.querySelector(".goal-fb"), v = LabKit.value(g.dataset.key);
    if (g.classList.contains("done") || goalMet(g, v)) { goalCheck(g.dataset.key, v); fb.textContent = "Done ✓ The model shows it."; fb.dataset.k = "ok"; return; }
    const ny = g.querySelector(".goal-ny");
    fb.innerHTML = ny ? ny.innerHTML : g.dataset.eq !== undefined ? `Not yet. The model shows ${v === undefined ? "nothing for this yet" : esc(String(v))}; this move needs ${g.dataset.eq}.` : "Not yet. Make the move in the model above, then check again.";
    fb.dataset.k = "no"; });
  goalTally();
  const TK = t && t.layers && t.layers.build ? buildTasks(t) : [];
  body.querySelectorAll("[data-tks]").forEach(w => {
    const tiles = [...w.querySelectorAll(".tk")], tally = () => { const s = tiles.filter(x => x.dataset.state === "solved").length; w.querySelector(".pz-sum b").textContent = s; tiles.forEach((x, i) => { const b = w.querySelector(`.pz-bar [data-i="${i}"]`); if (b) b.dataset.s = x.dataset.state === "open" ? "" : x.dataset.state; }); };
    tiles.forEach(x => { const T = TK[+x.dataset.tk], badge = x.querySelector(".pz-badge"), after = x.querySelector(".tk-after"), wk = x.querySelector(".tk-wk");
      let skipped = false, lines = null;
      // The first way to finish counts: a right answer (or every prediction right) = solved; Show the answer / reading all lines = shown.
      const fin = st => { if (x.dataset.state !== "open") return; after.hidden = false; x.dataset.state = st; badge.textContent = st === "solved" ? "Solved ✓" : "Answer shown"; tally(); if (lines) lines.all(); const dm = x.querySelector(".tk-dm"); if (dm && dm._demo && dm._demo.release) dm._demo.release(); };   // the picture plays through to its answer
      if (wk) lines = wireWk(wk, T.predict || [], { skip: () => { skipped = true; }, end: () => fin((T.predict || []).some(Boolean) && !skipped ? "solved" : "shown") });
      pzWire(x.querySelector(".tk-chk"), T.check, { rightText: "Correct.", right: () => fin("solved"), show: () => fin("shown") }); });
    tally();
  });
  const K = t && t.layers && t.layers.formal && t.layers.formal.checks;
  body.querySelectorAll("[data-pzs]").forEach(g => {   // Formal practice: type an answer, Check, hint, worked answer, progress
    const prog = body.querySelector("[data-pz-prog]"), done = body.querySelector(".pz-done");
    const tally = () => { const cards = [...g.querySelectorAll(".pz")], solved = cards.filter(c => c.dataset.state === "solved").length;
      if (prog) { prog.querySelector(".pz-sum b").textContent = solved; cards.forEach(c => { const s = prog.querySelector(`[data-i="${c.dataset.pz}"]`); if (s) s.dataset.s = c.dataset.state; }); }
      if (done) done.hidden = solved < cards.length; };
    g.querySelectorAll(".pz").forEach(c => {
      const k = K && K[+c.dataset.pz]; if (!k) return;
      const ans = c.querySelector(".a"), badge = c.querySelector(".pz-badge");
      const reveal = st => { ans.hidden = false; c.dataset.state = st; badge.textContent = st === "solved" ? "Solved ✓" : "Answer shown"; tally(); };
      pzWire(c, k, { rightText: "Correct. Here is the full write-up.", right: () => reveal(c.dataset.state === "shown" ? "shown" : "solved"), show: () => reveal("shown") });
    });
    tally();
  });
}
// A question figure with {echo: key} shows the lab's live value (k.publish in the lab), with a short pulse when it changes.
// A live figure: a lab value with thousands commas; null/undefined (e.g. a sum not worked out yet) shows the figure's own value ("?").
function echoText(v, fb){ return v == null ? String(fb) : typeof v === "number" ? v.toLocaleString("en-US") : String(v); }
window.addEventListener("inquire:lab-value", e => document.querySelectorAll(".cq-num[data-echo]").forEach(el => {
  if (el.dataset.echo !== e.detail.key) return; const v = echoText(e.detail.value, el.dataset.fb || ""); if (el.textContent === v) return;
  el.textContent = v; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
}));
/* Three-layer lessons (Arithmetic first, Oct 2026): Concept · Intermediate · Formal tabs change the text only; the lab stays.
   A topic opts in with t.layers = { concept: {lede, what, why, history, sources, examples}, build: {lede, intro, stepWhy, bridge, tasks}, formal: {lede, setup} };
   the rest comes from the usual fields (fields, legend, steps, example, formal, mistakes, practice). Spec: docs/subjects/LAYERS.md. */
function layerHTML(t, L){
  pzNudge = (t.layers || {}).nudge || "";
  const Y = t.layers, C = Y.concept || {}, B = Y.build || {}, F = Y.formal || {};
  const col = c => ({c1:"amber",c2:"cyan",c3:"pink",c4:"violet",c5:"green"}[c]);
  if (L === "concept" && C.ideas) return conceptHTML(t, C, col);
  if (L === "build" && B.task) return buildHTML(t, B, col);
  if (L === "formal" && F.question) return formalHTML(t, F, col);
  if (L === "concept") return `
    <div><h2>${C.heading || `What is ${esc(t.title.toLowerCase())}?`}</h2><span class="voice">Plain language</span>${C.what || t.plain}</div>
    <div><h2>Why it matters</h2>${C.why || t.why}
      <h3 style="margin-top:18px">Subjects that rely on it</h3><div class="fieldrow">${t.fields.map(f => `<div><b>${esc(f.name)}.</b> ${esc(f.use)}</div>`).join("")}</div></div>
    ${C.history ? `<div><h2>A short history</h2><div class="lyr-hist">${C.history}</div>${(C.sources || []).length ? `<p class="lyr-src"><span>Sources</span>${C.sources.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join(" · ")}</p>` : ""}</div>` : ""}
    <div><h2>Where you will meet it</h2><div class="careers lyr-ex">${(C.examples || t.careers.map(c => ({ role: c.role, scene: esc(c.use) }))).map(c => `<div class="career"><h4>${esc(c.role)}</h4><p>${c.scene}</p>${c.takeaway ? `<p class="lyr-take">${esc(c.takeaway)}</p>` : ""}</div>`).join("")}</div></div>`;
  if (L === "build") return `
    <div><h2>Reading the model</h2>${B.intro || ""}<div class="legend">${t.legend.map(k => `<div class="key" style="--c:var(--${col(k.c)})"><h3><span class="m">${k.sym}</span>${esc(k.name)}</h3><p>${k.desc}</p></div>`).join("")}</div></div>
    <div><h2>${esc(t.steps.title)}</h2><ol class="steps lyr-steps">${t.steps.items.map((s, i) => `<li><div>${s}${B.stepWhy && B.stepWhy[i] ? `<p class="lyr-why">${B.stepWhy[i]}</p>` : ""}</div></li>`).join("")}</ol></div>
    <div><h2>Worked example</h2><div class="ex"><div class="prompt"><p class="eyebrow">Problem</p>${t.example.prompt}</div>
      <div class="tbl"><table>${t.example.lines.map(l => `<tr><td>${l.math}</td><td>${esc(l.note || "")}</td></tr>`).join("")}</table></div>
      <div class="ans"><b>Answer.</b> ${t.example.answer}</div></div></div>
    <div><h2>Everyday tasks</h2>${B.bridge || ""}<ul class="lifelist lyr-tasks">${(B.tasks || t.life.map(x => ({ task: x }))).map(x => `<li><div><b>${esc(x.task)}</b>${x.link ? `<span>${x.link}</span>` : ""}</div></li>`).join("")}</ul></div>`;
  return `
    <div><h2>Formal statement</h2><span class="voice f">College level</span>${t.formal}</div>
    ${F.setup ? `<div><h2>${esc(F.setup.title)}</h2><ol class="steps lyr-setup">${F.setup.items.map(x => `<li><div>${x.say}${x.math ? `<div class="lyr-math">${x.math}</div>` : ""}</div></li>`).join("")}</ol></div>` : ""}
    <div><h2>Common mistakes</h2><div class="mist">${t.mistakes.map(m => `<div><div class="w">${m.wrong}</div><div class="f">${m.fix}</div></div>`).join("")}</div></div>
    <div><h2>Practice</h2><div class="prac">${t.practice.map((p, i) => `<div class="pq">${p.ctx ? `<p class="eyebrow lyr-ctx">${esc(p.ctx)}</p>` : ""}<div class="q"><span class="n">${String(i+1).padStart(2,"0")}</span>${p.q}</div><button type="button" class="btn-s" data-ans="${i}">Show answer</button><div class="a" hidden>${p.a}</div></div>`).join("")}</div></div>`;
}
function renderTopic(main){
  const id = S.topic, n = NODE[id], f = n.field, FNAME = DB.fields[f].name;
  const t = T[id] || stubTopic(id);
  store.set("lastTopic." + f, id);
  const st = stateOf(id);
  const ORDER = ORDERS[f], idx = ORDER.indexOf(id), prev = ORDER[idx - 1], next = ORDER[idx + 1];
  const pg = h("div", { class: "topic" });
  const voiceTxt = { young: "Written for young learners, with the formal version alongside", mixed: "Plain explanation with the formal version alongside", plain: "Stated plainly, adult level" }[t.voice] || "";
  const link = pid => { const s = stateOf(pid), tp = T[pid] || { title: pid, short: "" }, other = NODE[pid].field !== f ? ` <span style="font-weight:400;color:var(--faint)">· ${esc(DB.fields[NODE[pid].field].name)}</span>` : ""; return `<button type="button" class="plink" data-t="${pid}" data-st="${s}"><span class="o"${[...NODE[pid].icon].length > 3 ? ' style="font-size:10px;letter-spacing:-.02em"' : ""}>${NODE[pid].icon}</span><span><b>${esc(tp.title)}${other}</b><span>${t.prereqWhy?.[pid] || t.unlocksWhy?.[pid] || esc(tp.short)}</span></span></button>`; };
  const mathLink = m => { const r = mathRef(m); if (!r) return "";
    const why = (t.mathWhy && t.mathWhy[m]) || "";
    if (r.id) { const tp = T[r.id] || { title: r.id, short: "" }; return `<button type="button" class="plink" data-t="${r.id}" data-st="${stateOf(r.id)}"><span class="o">${NODE[r.id].icon}</span><span><b>${esc(tp.title)} <span style="font-weight:400;color:var(--faint)">· ${esc(DB.fields[NODE[r.id].field].name)}</span></b><span>${why || esc(tp.short)}</span></span></button>`; }
    const F2 = DB.fields[r.field]; return `<button type="button" class="plink" data-f="${r.field}" data-st="planned"><span class="o">${F2.icon}</span><span><b>${esc(r.name)} <span style="font-weight:400;color:var(--faint)">· ${esc(F2.name)}${charted(r.field) ? "" : " (planned)"}</span></b><span>${why}</span></span></button>`; };
  const mathList = (n.math || []).map(mathLink).filter(Boolean), physList = (n.physics || []).map(mathLink).filter(Boolean);
  const pathHTML = `
      <div><h2>Learning path</h2><div class="path">
        ${mathList.length ? `<div class="win"><div class="win-h"><span class="dot"></span>Mathematics you need</div><div class="in">${mathList.join("")}</div></div>` : ""}
        ${physList.length ? `<div class="win"><div class="win-h"><span class="dot"></span>Physics you need</div><div class="in">${physList.join("")}</div></div>` : ""}
        <div class="win"><div class="win-h"><span class="dot"></span>Master these first</div><div class="in">${n.pre.length ? n.pre.map(link).join("") : '<span class="empty">This is the starting point of the tree. Nothing is required first.</span>'}</div></div>
        <div class="win"><div class="win-h"><span class="dot"></span>This unlocks</div><div class="in">${n.post.length ? n.post.map(link).join("") : '<span class="empty">No later charted topic depends on this directly. It feeds the fields below.</span>'}</div></div>
        <div class="win"><div class="win-h"><span class="dot"></span>Vital in later fields</div><div class="in">${t.beyond.map(b => `<div class="plink" style="cursor:default"><span class="o">→</span><span><b>${esc(b.field)}</b><span>${esc(b.why)}</span></span></div>`).join("")}</div></div>
      </div></div>`;
  /* Bottom pager (1.18.4): two mirrored console cards, Previous lesson ◀ on the left and Next lesson ▶ on the right.
     At either end of the field the empty side leads back to the field's tree, so the pair always stays symmetric. */
  const pgCard = (dir, key, title, attr) => `<button type="button" class="pg-b pg-${dir}" ${attr}><span class="pg-arr" aria-hidden="true">${dir === "prev" ? "◀" : "▶"}</span><span class="pg-tx"><span class="pg-k">${key}</span><span class="pg-t">${esc(title)}</span></span></button>`;
  const pagerHTML = `
      <nav class="pager" aria-label="Lessons">${prev ? pgCard("prev", "Previous lesson", (T[prev] || { title: prev }).title, `data-t="${prev}"`) : pgCard("prev", "Back to", `${FNAME} tree`, "data-pg-tree")}${next ? pgCard("next", "Next lesson", (T[next] || { title: next }).title, `data-t="${next}"`) : pgCard("next", "Back to", `${FNAME} tree`, "data-pg-tree")}</nav>`;
  const layered = !!t.layers;
  const LAYERS = [["concept", "Concept", "New or returning: what it is and why it matters"], ["build", "Intermediate", "How to do it, step by step"], ["formal", "Formal", "State it precisely, then master it"]];
  let layer = store.get("layer", "concept"); if (!LAYERS.some(L => L[0] === layer)) layer = "concept";
  const ledeOf = L => (t.layers && t.layers[L] && t.layers[L].lede) || t.lede;
  const notesHTML = layered ? `<section class="notes"><div id="layer" class="lyr-body" role="tabpanel"></div>
      ${pathHTML}
      ${pagerHTML}
    </section>` : `
    <section class="notes">
      <div><h2>Reading the model</h2><div class="legend">${t.legend.map(k => `<div class="key" style="--c:var(--${{c1:"amber",c2:"cyan",c3:"pink",c4:"violet",c5:"green"}[k.c]})"><h3><span class="m">${k.sym}</span>${esc(k.name)}</h3><p>${k.desc}</p></div>`).join("")}</div></div>
      <div class="two">
        <div><h2>In plain words</h2><span class="voice">${t.voice === "young" ? "For a ten-year-old" : "Plain language"}</span>${t.plain}</div>
        <div><h2>Formal statement</h2><span class="voice f">College level</span>${t.formal}</div>
      </div>
      ${(t.stories || []).length ? `<div><h2>In the stories</h2><p>Passages from well-known books, with the words this topic is about picked out in colour. Every passage is quoted exactly from a public-domain edition.</p><div class="stories">${t.stories.map(storyPanel).join("")}</div></div>` : ""}
      <div><h2>${esc(t.steps.title)}</h2><ol class="steps">${t.steps.items.map(s => `<li><div>${s}</div></li>`).join("")}</ol></div>
      <div><h2>Worked example</h2><div class="ex"><div class="prompt"><p class="eyebrow">Problem</p>${t.example.prompt}</div>
        <div class="tbl"><table>${t.example.lines.map(l => `<tr><td>${l.math}</td><td>${esc(l.note)}</td></tr>`).join("")}</table></div>
        <div class="ans"><b>Answer.</b> ${t.example.answer}</div></div></div>
      <div><h2>Why it matters</h2>${t.why}
        <h3 style="margin-top:18px">Careers that use it</h3><div class="careers">${t.careers.map(c => `<div class="career"><h4>${esc(c.role)}</h4><p>${esc(c.use)}</p></div>`).join("")}</div>
        <div class="two" style="margin-top:22px"><div><h3>Everyday tasks</h3><ul class="lifelist">${t.life.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div><h3>Subjects that rely on it</h3><div class="fieldrow">${t.fields.map(f => `<div><b>${esc(f.name)}.</b> ${esc(f.use)}</div>`).join("")}</div></div></div>
      </div>
      ${pathHTML}
      <div><h2>Common mistakes</h2><div class="mist">${t.mistakes.map(m => `<div><div class="w">${m.wrong}</div><div class="f">${m.fix}</div></div>`).join("")}</div></div>
      <div><h2>Practice</h2><div class="prac">${t.practice.map((p, i) => `<div class="pq"><div class="q"><span class="n">${String(i+1).padStart(2,"0")}</span>${p.q}</div><button type="button" class="btn-s" data-ans="${i}">Show answer</button><div class="a" hidden>${p.a}</div></div>`).join("")}</div></div>
      ${t.origin ? `<div><h2>Origin</h2><p class="origin">${t.origin}</p></div>` : ""}
      ${pagerHTML}
    </section>`;
  pg.innerHTML = `
  <div class="topic-bar">
    <button type="button" class="btn-s navtoggle" id="navtoggle2">☰</button>
    <button type="button" class="btn-s" id="back">◀ ${esc(FNAME)} tree</button>
    <span class="sp"></span>
    ${st === "mastered" ? '<span class="pill m">Mastered</span>' : st === "avail" ? '<span class="pill a">Ready to study</span>' : '<span class="pill l">Prerequisites open</span>'}
    <button type="button" class="btn ${st === "mastered" ? "ghost" : "good"}" id="mast">${st === "mastered" ? "Unmark mastered" : "Mark as mastered"}</button>
    ${next && st === "mastered" ? `<button type="button" class="btn next-btn" data-t="${next}" title="Next lesson: ${esc((T[next] || { title: next }).title)}"><span class="nb-k">Next lesson</span><span class="nb-t">${esc((T[next] || { title: next }).title)}</span> ▶</button>` : ""}
  </div>
  <div class="wrap">
    ${layered ? `<div class="lyr-tabs win" role="tablist" aria-label="Lesson level">${LAYERS.map(([k, name, sub], i) => `<button type="button" role="tab" class="lyr-tab" data-layer="${k}" aria-selected="${k === layer}" aria-controls="layer"><span class="lyr-n"><i>${i + 1}</i></span><span><b>${name}</b><span>${sub}</span></span></button>`).join("")}</div>` : ""}
    <header class="intro">
      <div><p class="eyebrow">${t.eyebrow}</p><h1>${t.hero}</h1>
        <p class="lede" id="lede">${layered ? ledeOf(layer) : t.lede}</p>
        <div class="meta"><span class="pill l">${esc(t.grade)}</span><span class="pill l">About ${t.hours} h to master</span>${layered ? "" : `<span class="pill l">${esc(voiceTxt)}</span>`}</div></div>
    </header>
    <section class="lab" aria-label="Interactive model">
      <div class="stage" id="stage"></div>
      <aside class="readout" id="readout" aria-live="off"></aside>
      <div class="controls" id="controls"></div>
    </section>
    ${notesHTML}
    </section>
  </div>`;
  main.appendChild(pg);
  pg.scrollTop = 0;
  $("#back", pg).onclick = () => go({ view: "math", field: f, topic: null });
  pg.querySelectorAll("[data-pg-tree]").forEach(b => b.onclick = () => go({ view: "math", field: f, topic: null }));
  $("#navtoggle2", pg).onclick = () => main.parentElement.classList.toggle("navopen");
  $("#mast", pg).onclick = () => { if (mastered.has(id)) mastered.delete(id); else mastered.add(id); saveMastered(); const y = pg.scrollTop, now = mastered.has(id); render(); const np = $(".topic"); if (np) np.scrollTop = y;
    const nb = np && np.querySelector(".next-btn"); if (nb && now) nb.classList.add("nudge"); };   // just mastered: the Next button glows once
  if (layered) {
    const body = $("#layer", pg);
    const draw = L => {
      layer = L; store.set("layer", L);
      pg.querySelectorAll(".lyr-tab").forEach(b => b.setAttribute("aria-selected", String(b.dataset.layer === L)));
      $("#lede", pg).innerHTML = ledeOf(L);
      body.innerHTML = layerHTML(t, L);
      const hlObjs = L === "concept" || L === "build" ? (((t.layers[L] || {}).objects) || []) : null;   // colour cues on Concept and Intermediate
      if (hlObjs && (t.layers.concept.objects || t.layers.build.objects)) { body.dataset.hl = JSON.stringify(hlObjs); hlText(body); const ld = $("#lede", pg); ld.dataset.hl = body.dataset.hl; hlText(ld); } else { delete body.dataset.hl; delete $("#lede", pg).dataset.hl; }
      if (window.InquireDemo) InquireDemo.mountAll(body);
      wireBlocks(body, pg, t);
      body.querySelectorAll("[data-lab]").forEach(b => b.onclick = () => {   // "Try it" chips: drive the lab, then bring it into view
        if (!LabKit.drive(b.dataset.lab)) return;
        labIntoView(pg);
      });
      body.querySelectorAll("[data-ans]").forEach(b => b.onclick = () => { const a = b.nextElementSibling; a.hidden = !a.hidden; b.textContent = a.hidden ? "Show answer" : "Hide answer"; });
      window.dispatchEvent(new CustomEvent("inquire:layer", { detail: { topic: id, layer: L } }));
    };
    pg.querySelectorAll(".lyr-tab").forEach(b => {
      b.onclick = () => draw(b.dataset.layer);
      b.onkeydown = e => { if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return; const i = LAYERS.findIndex(L => L[0] === layer), j = (i + (e.key === "ArrowRight" ? 1 : 2)) % 3; draw(LAYERS[j][0]); pg.querySelector(`.lyr-tab[data-layer="${LAYERS[j][0]}"]`).focus(); };
    });
    draw(layer);
  }
  pg.querySelectorAll("[data-t]").forEach(b => b.onclick = () => go({ view: "math", field: fieldOf(b.dataset.t), topic: b.dataset.t }));
  pg.querySelectorAll(".plink[data-f]").forEach(b => b.onclick = () => go({ view: "math", field: b.dataset.f, topic: null }));
  if ((t.stories || []).length) glossaryPopover(pg, subjOf(f));
  pg.querySelectorAll("[data-ans]").forEach(b => b.onclick = () => { const a = b.nextElementSibling; a.hidden = !a.hidden; b.textContent = a.hidden ? "Show answer" : "Hide answer"; });
  // lab
  const lab = window.LABS && window.LABS[id];
  const stage = $("#stage", pg), ro = $("#readout", pg), ctl = $("#controls", pg);
  if (lab) { try { const d = lab(LabKit.make(stage, ro, ctl)); if (d) cleanup.push(d); } catch(err) { console.error(err); stage.innerHTML = `<div class="fallback">The model for this topic could not start.</div>`; } }
  else stage.innerHTML = `<div class="fallback">Model coming soon.</div>`;
  cleanup.push(() => LabKit.stopAll());
}

/* ---------- glossary (shared by every subject; spec web/GLOSSARY-SPEC.md) ---------- */
// One entry = one subject's sense block for one headword. Blocks are grouped by headword; each block is marked by its
// subject: stripe/chip colour = subject group (DB.glossaryGroupColour), glyph = subject, plus subject · field text.
const GL = DB.glossary || [];
const GSUB = Object.fromEntries((DB.subjects || []).map(s => [s.id, s]));
const SUBORDER = (DB.subjects || []).map(s => s.id);
const gColour = sub => (DB.glossaryGroupColour || {})[(GSUB[sub] && GSUB[sub].group) || "reference"] || "var(--line-2)";
const gGlyph = sub => (GSUB[sub] && GSUB[sub].glyph) || "·";
const gName = sub => (GSUB[sub] && GSUB[sub].name) || sub;
const GWORDS = {};
GL.forEach(e => (GWORDS[e.w.toLowerCase()] = GWORDS[e.w.toLowerCase()] || []).push(e));
const GFORM = {};
Object.keys(GWORDS).forEach(k => { GFORM[k] = k; });
Object.keys(GWORDS).forEach(k => GWORDS[k].forEach(e => (e.forms || []).forEach(f => { const x = f.toLowerCase(); if (!GFORM[x]) GFORM[x] = k; })));
const gLookup = w => { const x = String(w).toLowerCase().replace(/[’']s$/, ""); return GFORM[x] || null; };
const gSubjects = () => SUBORDER.filter(s => GL.some(e => e.subject === s));
const gStrip = s => String(s).replace(/<[^>]+>/g, "");
// blocks of a headword, the preferred subject first, then subject order
const gBlocks = (k, pref) => (GWORDS[k] || []).slice().sort((a, b) => (b.subject === pref) - (a.subject === pref) || SUBORDER.indexOf(a.subject) - SUBORDER.indexOf(b.subject));
const plannedNode = id => { for (const [f, tr] of Object.entries(TREES)) { const n = (tr.planned || []).find(x => x.id === id); if (n) return { ...n, field: f }; } return null; };
const G = { q: "", sub: "all", field: null, letter: null, word: null, ret: null, mine: store.get("glmine", false) };
function gTok(){ return "glossary" + (G.sub !== "all" ? "-" + G.sub : "") + (G.word ? "~" + encodeURIComponent(G.word) : ""); }
function openGlossary(o = {}){
  if (o.from) { G.ret = o.from; G.q = ""; G.field = null; G.letter = null; }
  if ("sub" in o) { G.sub = o.sub || "all"; if (G.field && (!DB.fields[G.field] || subjOf(G.field) !== G.sub)) G.field = null; }
  if ("field" in o && o.field && DB.fields[o.field] && subjOf(o.field) === G.sub) G.field = o.field;
  if ("q" in o) G.q = o.q || "";
  if ("word" in o) G.word = o.word;
  go({ view: "glossary", topic: null });
}
function gScore(k, blocks, q){
  if (!q) return 1;
  if (k === q) return 100; if (k.startsWith(q)) return 80; if (k.includes(q)) return 60;
  let s = 0; const qm = q.replace(/^-|-$/g, "");
  blocks.forEach(e => {
    if ((e.forms || []).some(f => f.toLowerCase().startsWith(q))) s = Math.max(s, 50);
    if (qm && (e.parts || []).some(p => p[0].toLowerCase() === qm)) s = Math.max(s, 45);
    if (qm.length > 2 && (e.parts || []).some(p => p[0].toLowerCase().startsWith(qm))) s = Math.max(s, 35);
    if (q.length > 2 && e.senses.some(x => gStrip(x).toLowerCase().includes(q))) s = Math.max(s, 10);
  });
  return s;
}
function gVisible(){
  const q = G.q.trim().toLowerCase();
  return Object.keys(GWORDS).map(k => {
    const blocks = GWORDS[k].filter(e => (G.sub === "all" || e.subject === G.sub) && (!G.field || e.field === G.field) && (!G.mine || (e.node && mastered.has(e.node))));
    return { k, blocks, score: blocks.length ? gScore(k, blocks, q) : 0 };
  }).filter(x => x.score > 0 && (!G.letter || q || x.k[0] === G.letter))
    .sort((a, b) => b.score - a.score || a.k.localeCompare(b.k));
}
// part of speech: a neutral pill with a small square in the grammar colour (subject colour stays on the stripe only)
function gPos(e){ const p = DB.posTags[e.pos]; return p ? `<span class="gl-pos"><i class="${p.c}"></i>${esc(p.name)}</span>` : ""; }
function gNodeLink(e){
  if (e.node && NODE[e.node]) return `<button type="button" class="lnk charted" data-t="${e.node}">Taught in · ${esc(T[e.node] ? T[e.node].title : e.node)}</button>`;
  const pn = e.node && plannedNode(e.node);
  if (pn) return `<button type="button" class="lnk" data-f="${pn.field}">Planned topic · ${esc(pn.label)}</button>`;
  if (e.field && DB.fields[e.field]) return `<button type="button" class="lnk${charted(e.field) ? " charted" : ""}" data-f="${e.field}">${esc(DB.fields[e.field].name)}${charted(e.field) ? "" : " (planned)"}</button>`;
  return "";
}
function gQuote(q){
  const t = T[q.topic]; const st = t && (t.stories || []).find(s => DB.storyText(s.tokens).includes(q.text));
  if (!st) return "";
  return `<blockquote class="gl-q"><p>“${esc(q.text)}”</p><footer>${esc(st.author)} · <i>${esc(st.book)}</i> (${st.year}) <button type="button" class="gl-a" data-t="${q.topic}">See the passage</button></footer></blockquote>`;
}
function gSense(e, headIpa){
  const pairs = (lb, xs) => xs && xs.length ? `<div class="gl-rel"><span class="lb">${lb}</span>${xs.map(p => Array.isArray(p) ? `<span><b>${gw(p[0])}</b> ${p[1]}</span>` : `<span><b>${gw(p)}</b></span>`).join("")}</div>` : "";
  const gw = w => GWORDS[w.toLowerCase()] ? `<button type="button" class="gl-a" data-gword="${esc(w.toLowerCase())}">${esc(w)}</button>` : esc(w);
  const f = e.field && DB.fields[e.field];
  return `<article class="gl-sense" style="--gc:${gColour(e.subject)}">
    <div class="gl-sh"><span class="gl-glyph" aria-hidden="true">${gGlyph(e.subject)}</span><span class="gl-subj">${esc(gName(e.subject))}</span>${f ? `<span class="gl-fld">${esc(f.name)}</span>` : ""}<span class="gl-tags">${gPos(e)}${e.register ? `<span class="gl-tag">${esc(DB.glossaryRegister[e.register])}</span>` : ""}${e.conno ? `<span class="gl-tag">${esc(e.conno)} connotation</span>` : ""}</span></div>
    ${e.ipa !== headIpa ? `<div class="gl-say"><span class="ipa">${esc(e.ipa)}</span>${e.syl ? `<span class="syl">${esc(e.syl)}</span>` : ""}</div>` : ""}
    <ol class="gl-defs">${e.senses.map(s => `<li>${s}</li>`).join("")}</ol>
    ${e.ex ? `<p class="gl-ex"><span class="lb">Example</span>${e.ex}</p>` : ""}
    ${e.quote ? gQuote(e.quote) : ""}
    ${e.parts ? `<div class="gl-parts" aria-label="Word parts">${e.parts.map(p => `<span class="mp"><b>${esc(p[0])}</b><small>${p[1]}</small></span>`).join('<span class="pl">+</span>')}</div>` : ""}
    ${e.origin ? `<p class="gl-orig"><span class="lb">Origin</span>${e.origin}</p>` : ""}
    ${pairs("Synonyms", e.syn)}${pairs("Antonyms", e.ant)}${pairs("Often confused with", e.confused)}
    ${gNodeLink(e) ? `<div class="gl-links">${gNodeLink(e)}</div>` : ""}
  </article>`;
}
function gEntry(k, sub = G.sub, pref = sub !== "all" ? sub : (G.ret && G.ret.subject)){
  const blocks = gBlocks(k, pref);
  if (!blocks.length) return `<div class="gl-empty">Pick a word from the list.</div>`;
  const head = blocks[0], subs = [...new Set(blocks.map(e => e.subject))];
  const see = [...new Set(blocks.flatMap(e => e.see || []))].filter(w => w.toLowerCase() !== k);
  const hidden = sub !== "all" ? GWORDS[k].filter(e => e.subject !== sub).length : 0;
  const shown = sub !== "all" ? blocks.filter(e => e.subject === sub) : blocks;
  return `<button type="button" class="btn-s gl-back" id="glback">◀ All words</button>
    <header class="gl-head"><h2>${esc(head.w)}</h2><div class="gl-say"><span class="ipa">${esc(head.ipa)}</span>${head.syl ? `<span class="syl">${esc(head.syl)}</span>` : ""}</div>
      <div class="gl-in">${subs.map(s => `<span class="gl-chip sm" style="--gc:${gColour(s)}"><span class="g">${gGlyph(s)}</span>${esc(gName(s))}</span>`).join("")}</div></header>
    ${shown.map(e => gSense(e, head.ipa)).join("")}
    ${hidden ? `<button type="button" class="btn-s gl-more" id="glall">Show ${hidden} more sense${hidden === 1 ? "" : "s"} from other subjects</button>` : ""}
    ${see.length ? `<div class="gl-rel gl-see"><span class="lb">See also</span>${see.map(w => `<button type="button" class="gl-a" data-gword="${esc(w.toLowerCase())}">${esc(w)}</button>`).join("")}</div>` : ""}`;
}
// a glossary word read inside a subject (sidebar Glossary list), beside its field map, tree or topic
function renderWordPane(main){
  const k = S.gword, gn = GWORDS[k].some(e => e.subject === S.subject);
  const sub = S.glScope === "all" || !gn ? "all" : S.subject;
  const under = S.topic && T[S.topic] ? T[S.topic].title : S.field !== "map" && DB.fields[S.field] ? DB.fields[S.field].name : SM[S.subject].name + " field map";
  const head = h("div", { class: "tree-head" });
  head.innerHTML = `<button type="button" class="btn-s navtoggle" id="navtoggle2">☰ Words</button><div><h2>Glossary</h2><div class="sub">${esc(sub === "all" ? "Every subject" : SM[S.subject].name)} · ${esc(GWORDS[k][0].w)}</div></div>
    <div class="gl-pane-act"><button type="button" class="btn-s" id="wpback">◀ ${esc(under)}</button><button type="button" class="btn-s" id="wpfull">Full glossary ↗</button></div>`;
  main.appendChild(head);
  $("#navtoggle2", head).onclick = () => main.parentElement.classList.toggle("navopen");
  const pane = h("div", { class: "gl-pane" });
  const entry = h("section", { class: "gl-entry win", "aria-live": "polite" }, gEntry(k, sub, S.subject));
  pane.appendChild(entry); main.appendChild(pane);
  $("#wpback", head).onclick = () => go({ view: "math" });
  $("#wpfull", head).onclick = () => openGlossary({ from: { label: SM[S.subject].name + " · " + under, subject: S.subject, state: { view: "math", subject: S.subject, field: S.field, topic: S.topic } }, sub, word: k });
  entry.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.id === "glall") { S.glScope = "all"; render(); return; }
    if (b.dataset.gword != null) { go({ view: "math", gword: b.dataset.gword }); return; }
    if (b.dataset.t) { go({ view: "math", field: fieldOf(b.dataset.t), topic: b.dataset.t }); return; }
    if (b.dataset.f) { go({ view: "math", field: b.dataset.f, topic: null }); return; }
  });
}
function renderGlossary(){
  const subs = gSubjects();
  if (G.sub !== "all" && !subs.includes(G.sub)) G.sub = "all";
  const s = h("div", { class: "screen gl-screen" });
  const groups = (DB.subjectGroups || []).map(g => `<span><i style="background:${(DB.glossaryGroupColour || {})[g.id]}"></i>${esc(g.name)}</span>`).join("");
  s.innerHTML = `<div class="screen-in gl-wrap">
    <div class="hello gl-hello"><div class="gl-top">${G.ret ? `<button type="button" class="btn-s" id="glret">◀ ${esc(G.ret.label)}</button>` : ""}<button type="button" class="btn-s gl-menu" id="glmenu">◀ Menu</button></div>
      <p class="eyebrow">Glossary · every subject</p><h1>Glossary</h1>
      <p>The words each subject uses, with pronunciation, word parts, origin and examples. One word can mean different things in different subjects: each sense is marked with its subject’s glyph, and its stripe colour shows the subject group.</p>
      <div class="gl-key" aria-label="Stripe colours">${groups}</div></div>
    <div class="gl-tools win"><div class="in">
      <label class="search"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke="#8B97AE" stroke-width="1.4"/><path d="M9.5 9.5 13 13" stroke="#8B97AE" stroke-width="1.4"/></svg>
        <input id="glq" type="text" placeholder="Search words, word parts (dict, logy) and definitions" aria-label="Search the glossary" value="${esc(G.q)}"></label>
      <div class="gl-chips" id="glsub" role="group" aria-label="Subject"></div>
      <div class="gl-chips gl-fields" id="glfield" role="group" aria-label="Field"></div>
      <div class="gl-row"><div class="gl-az" id="glaz" role="group" aria-label="First letter"></div>
        <label class="gl-mine"><input type="checkbox" id="glmine"${G.mine ? " checked" : ""}> Mastered topics only</label></div>
    </div></div>
    <div class="gl-body" id="glbody"><nav class="gl-list win" id="gllist" aria-label="Words"></nav><section class="gl-entry win" id="glentry" aria-live="polite"></section></div>
  </div>`;
  viewEl.appendChild(s);
  const q = $("#glq", s), list = $("#gllist", s), entry = $("#glentry", s), body = $("#glbody", s);
  const subChips = $("#glsub", s), fldChips = $("#glfield", s), az = $("#glaz", s);
  const count = sub => Object.keys(GWORDS).filter(k => GWORDS[k].some(e => sub === "all" || e.subject === sub)).length;
  subChips.innerHTML = [["all", "All subjects", "◎", "var(--line-2)"], ...subs.map(x => [x, gName(x), gGlyph(x), gColour(x)])]
    .map(([id, nm, gl, c]) => `<button type="button" class="gl-chip" data-sub="${id}" aria-pressed="${G.sub === id}" style="--gc:${c}"><span class="g">${gl}</span>${esc(nm)}<span class="n">${count(id)}</span></button>`).join("");
  if (G.sub !== "all") {
    const flds = [...new Set(GL.filter(e => e.subject === G.sub && e.field).map(e => e.field))];
    fldChips.innerHTML = flds.length > 1 ? `<button type="button" class="gl-chip sm" data-fld="" aria-pressed="${!G.field}" style="--gc:${gColour(G.sub)}">All fields</button>` + flds.map(f => `<button type="button" class="gl-chip sm" data-fld="${f}" aria-pressed="${G.field === f}" style="--gc:${gColour(G.sub)}">${esc(DB.fields[f].name)}</button>`).join("") : "";
  }
  fldChips.hidden = !fldChips.innerHTML;
  function drawList(){
    const vis = gVisible(), qq = G.q.trim();
    const letters = new Set(Object.keys(GWORDS).filter(k => GWORDS[k].some(e => G.sub === "all" || e.subject === G.sub)).map(k => k[0]));
    az.innerHTML = `<button type="button" class="gl-l" data-l="" aria-pressed="${!G.letter}">All</button>` + "abcdefghijklmnopqrstuvwxyz".split("").map(l => `<button type="button" class="gl-l" data-l="${l}" aria-pressed="${G.letter === l}"${letters.has(l) ? "" : " disabled"}>${l.toUpperCase()}</button>`).join("");
    list.innerHTML = `<div class="win-h"><span class="dot"></span>${vis.length} word${vis.length === 1 ? "" : "s"}${qq ? ` matching “${esc(qq)}”` : ""}</div>` + (vis.length ? vis.map(({ k, blocks }) =>
      `<button type="button" class="gl-item${G.word === k ? " sel" : ""}" data-gword="${esc(k)}"><span class="w">${esc(GWORDS[k][0].w)}</span><span class="gs">${[...new Set(blocks.map(e => e.subject))].map(x => `<i style="--gc:${gColour(x)}" title="${esc(gName(x))}">${gGlyph(x)}</i>`).join("")}</span></button>`).join("")
      : `<div class="gl-empty">No words match. Try fewer letters, another subject, or turn off “Mastered topics only”.</div>`);
    if (vis.length && window.innerWidth > 760 && !vis.some(x => x.k === G.word)) { G.word = vis[0].k; drawEntry(); }
  }
  function drawEntry(){
    body.classList.toggle("has-sel", !!G.word);
    entry.innerHTML = G.word && GWORDS[G.word] ? gEntry(G.word) : `<div class="gl-empty">Pick a word from the list.</div>`;
    list.querySelectorAll(".gl-item").forEach(b => b.classList.toggle("sel", b.dataset.gword === G.word));
    const back = $("#glback", entry); if (back) back.onclick = () => { G.word = null; body.classList.remove("has-sel"); entry.innerHTML = ""; try { history.replaceState(history.state, "", "#" + gTok()); } catch(e){} };
    const all = $("#glall", entry); if (all) all.onclick = () => { G.sub = "all"; G.field = null; openGlossary({}); };
  }
  const pick = k => { G.word = k; drawEntry(); try { history.replaceState({ view: "glossary" }, "", "#" + gTok()); } catch(e){} if (window.innerWidth <= 760) s.scrollTop = body.offsetTop - 8; else entry.scrollTop = 0; };
  s.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || !s.contains(b)) return;
    if (b.dataset.gword != null) { pick(b.dataset.gword); return; }
    if (b.dataset.sub != null) { G.sub = b.dataset.sub; G.field = null; G.letter = null; G.word = null; openGlossary({}); return; }
    if (b.dataset.fld != null) { G.field = b.dataset.fld || null; G.word = null; openGlossary({}); return; }
    if (b.dataset.l != null) { G.letter = b.dataset.l || null; drawList(); return; }
    if (b.dataset.t) { go({ view: "math", field: fieldOf(b.dataset.t), topic: b.dataset.t }); return; }
    if (b.dataset.f) { go({ view: "math", field: b.dataset.f, topic: null }); return; }
  });
  q.addEventListener("input", () => { G.q = q.value; drawList(); });
  q.addEventListener("keydown", e => { if (e.key === "Enter") { const first = list.querySelector(".gl-item"); if (first) pick(first.dataset.gword); } });
  $("#glmine", s).onchange = e => { G.mine = e.target.checked; store.set("glmine", G.mine); drawList(); };
  $("#glmenu", s).onclick = () => go({ view: "menu", topic: null });
  const r = $("#glret", s); if (r) r.onclick = () => { const to = G.ret; G.ret = null; go(to.state); };
  drawList(); drawEntry();
  if (G.word && window.innerWidth <= 760) requestAnimationFrame(() => { s.scrollTop = body.offsetTop - 8; });
}
// Word card for story panels: a dotted word opens a short card; "Open in glossary" goes to the full entry.
function glossaryPopover(root, subject){
  let pop = null;
  const close = () => { if (pop) { pop.remove(); pop = null; } };
  const open = el => {
    close();
    const k = el.dataset.gw, gp = el.dataset.gp, all = gBlocks(k, subject);
    const blocks = gp ? all.filter(x => x.pos === gp).concat(all.filter(x => x.pos !== gp)) : all, e = blocks[0]; if (!e) return;
    const others = [...new Set(blocks.slice(1).map(x => x.subject))].filter(x => x !== e.subject);
    pop = h("div", { class: "gl-pop", role: "dialog", "aria-label": "Glossary: " + e.w, style: `--gc:${gColour(e.subject)}` },
      `<div class="gl-pop-h"><b>${esc(e.w)}</b><span class="ipa">${esc(e.ipa)}</span>${gPos(e)}</div><p>${e.senses[0]}</p>
       <div class="gl-pop-f">${others.length ? `<span class="gl-pop-o">Also in ${others.map(x => `<i style="--gc:${gColour(x)}" title="${esc(gName(x))}">${gGlyph(x)}</i>`).join("")}</span>` : ""}<button type="button" class="btn-s" data-open>Open in glossary</button></div>`);
    document.body.appendChild(pop);
    const r = el.getBoundingClientRect(), pw = Math.min(320, window.innerWidth - 24);
    pop.style.width = pw + "px";
    pop.style.left = Math.max(12, Math.min(window.innerWidth - pw - 12, r.left + r.width / 2 - pw / 2)) + "px";
    const below = r.bottom + 8, ph = pop.offsetHeight;
    pop.style.top = (below + ph > window.innerHeight - 8 && r.top - ph - 8 > 8 ? r.top - ph - 8 : below) + "px";
    $("[data-open]", pop).onclick = () => { const st = { view: "math", field: S.field, topic: S.topic }; close(); openGlossary({ from: { label: T[S.topic] ? T[S.topic].title : "Back", subject, state: st }, sub: "all", word: k }); };
  };
  root.addEventListener("click", e => { const el = e.target.closest("[data-gw]"); if (el && root.contains(el)) { e.stopPropagation(); open(el); } });
  root.addEventListener("keydown", e => { const el = e.target.closest && e.target.closest("[data-gw]"); if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(el); } });
  const outside = e => { if (pop && !pop.contains(e.target)) close(); };
  const esc2 = e => { if (e.key === "Escape") close(); };
  document.addEventListener("click", outside); document.addEventListener("keydown", esc2);
  const sc = root.closest(".topic"); if (sc) sc.addEventListener("scroll", close, { passive: true });
  window.addEventListener("resize", close);
  cleanup.push(() => { close(); document.removeEventListener("click", outside); document.removeEventListener("keydown", esc2); window.removeEventListener("resize", close); });
}

/* ---------- desktop shell (only inside the Inquire Law app) ---------- */
let DESK_VERSION = "";
if (window.inquireDesktop) {
  const D = window.inquireDesktop;
  document.documentElement.classList.add("desktop", "os-" + D.platform);
  D.version().then(v => { DESK_VERSION = v; const el = document.querySelector("#verline .num"); if (el) el.textContent = "v" + v; });
  const bar = $("#upd");
  let hideT = null;
  D.onUpdate(s => {
    clearTimeout(hideT);
    const v = s.version ? esc(s.version) : "";
    let html = "", keep = true;
    if (s.status === "downloading") html = `<span class="dot"></span>Downloading Inquire Law ${v}… <span class="num">${s.percent || 0}%</span>`;
    else if (s.status === "ready") html = `<span class="dot"></span>Inquire Law ${v} is ready.<button type="button" class="btn good" id="upd-go">Install &amp; Relaunch</button><button type="button" class="btn-s" id="upd-x">Later</button>`;
    else if (s.status === "installing") html = `<span class="dot"></span>Installing Inquire Law ${v}…`;
    else if (s.status === "installed") { html = `<span class="dot"></span>Updated to Inquire Law ${v}.`; keep = false; }
    else if (s.status === "blocked") html = `<span class="dot"></span>macOS blocked the update. Inquire Law ${v} is in your Downloads folder: drag it into Applications and replace the old copy.<button type="button" class="btn-s" id="upd-rev">Show in Finder</button><button type="button" class="btn-s" id="upd-x">Dismiss</button>`;
    else if (s.status === "error" && s.message) html = `<span class="dot err"></span>Update problem: ${esc(s.message)}<button type="button" class="btn-s" id="upd-x">Dismiss</button>`;
    bar.hidden = !html; bar.innerHTML = html;
    const go = $("#upd-go"); if (go) go.onclick = () => { go.disabled = true; D.installUpdate(); };
    const x = $("#upd-x"); if (x) x.onclick = () => { bar.hidden = true; };
    const rv = $("#upd-rev"); if (rv) rv.onclick = () => D.revealUpdate();
    if (!keep) hideT = setTimeout(() => bar.hidden = true, 6000);
  });
}

/* ---------- hooks for the corner dock (web/src/dock.js) ---------- */
window.InquireApp = {
  // how closely a note's links match the screen the user is on: 3 = this lesson, 2 = this field, 1 = this subject, 0 = not linked here (Assist → Notes puts these on top)
  noteHere(n){
    if (S.view !== "math" || !n || !Array.isArray(n.links)) return { score: 0 };
    const topic = S.topic || null, field = topic && NODE[topic] ? fieldOf(topic) : (S.field && S.field !== "map" ? S.field : null), subj = S.subject;
    let best = { score: 0 };
    n.links.forEach(k => { const id = k.slice(2), sc = k[0] === "t" && id === topic ? 3 : k[0] === "f" && id === field ? 2 : k[0] === "s" && id === subj ? 1 : 0;
      if (sc > best.score) best = { score: sc, label: sc === 3 ? (T[id] ? T[id].title : id) : sc === 2 ? (DB.fields[id] ? DB.fields[id].name : id) : (SM[id] ? SM[id].name : id) }; });
    return best;
  },
  context(){ const t = S.topic && T[S.topic]; return { userName: window.InquireUserName || window.InquireUser || "", view: MW.notes ? "notes" : MW.achievements ? "achievements" : S.view, gword: S.view === "math" ? S.gword : S.view === "glossary" ? G.word : null, subject: S.subject, subjectName: SM[S.subject] ? SM[S.subject].name : "", field: S.view === "math" ? S.field : null,
    fieldName: S.view === "math" && DB.fields[S.field] ? DB.fields[S.field].name : "", topic: S.topic || null, topicTitle: t ? t.title : "" }; },
  openTopic: id => go({ view: "math", topic: id }), openNotes: id => { if (id) { NOTES.sel = id; const n = window.InquireNotes && InquireNotes.get(id); if (n) { NOTES.folder = "all"; NOTES.subj = ""; NOTES.q = ""; } } go({ view: "notes", topic: null }); },
  // right-click → Glossary: the entry shown inside the menu (headword, IPA, part of speech, each subject's first senses), or null
  glossaryDef(text){
    const w = String(text || "").trim().replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    const k = w && gLookup(w); if (!k) return null;
    const bl = gBlocks(k, S.subject);
    return { key: k, word: bl[0].w, ipa: bl[0].ipa || "", blocks: bl.map(e => ({ subject: gName(e.subject), glyph: gGlyph(e.subject), colour: gColour(e.subject),
      field: DB.fields[e.field] ? DB.fields[e.field].name : "", pos: DB.posTags[e.pos] ? DB.posTags[e.pos].name : "", senses: (e.senses || []).slice(0, 2),
      node: e.node && T[e.node] ? e.node : "", nodeTitle: e.node && T[e.node] ? T[e.node].title : "" })) };
  },
  // right-click "Define": the glossary entry if the words are a headword (or one of its forms), else a glossary search for them
  define(text){
    const w = String(text || "").trim().replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!w) return false;
    const k = gLookup(w);
    if (k && S.view === "math") { go({ view: "math", gword: k }); return true; }
    const from = MW.notes ? { label: "My notes", state: { view: "notes", topic: null } }
      : S.view === "math" ? { label: S.topic && T[S.topic] ? T[S.topic].title : SM[S.subject].name, subject: S.subject, state: { view: "math", subject: S.subject, field: S.field, topic: S.topic } } : null;
    openGlossary({ from, sub: "all", q: k ? "" : w, word: k || null });
    return !!k;
  },
  linkLabel, linkTargets, openLink,
  modal: modalWin, closeWin: id => { if (id) { if (MW[id]) MW[id].close(); } else closeWins(); }, openWin: id => WIN_VIEWS[id] && WIN_VIEWS[id](), winOpen: id => (id ? !!MW[id] : Object.keys(MW).length > 0),
  go: v => go(v),
  // for Achievements: what has been mastered, per subject and per charted field (written lessons only)
  progress(){
    const by = {}, groups = {};
    mastered.forEach(id => { if (!NODE[id]) return; const sb = subjOf(fieldOf(id)); by[sb] = (by[sb] || 0) + 1; const g = (GSUB[sb] && GSUB[sb].group) || "stem"; groups[g] = (groups[g] || 0) + 1; });
    const fields = Object.keys(DB.fields).filter(f => charted(f) && SM[subjOf(f)]).map(f => { const pool = fieldNodes(f).filter(n => T[n.id]); return { id: f, name: DB.fields[f].name, subject: subjOf(f), colour: gColour(subjOf(f)), done: pool.filter(n => mastered.has(n.id)).length, total: pool.length }; }).filter(x => x.total);
    return { mastered: [...mastered].filter(id => NODE[id]).length, bySubject: by, byGroup: groups, fields };
  },
  subjectName: id => (SM[id] ? SM[id].name : id), subjectColour: id => gColour(id),
  // keyboard shortcuts (Settings → Shortcuts) that act on screens
  shortcut(name){
    if (name === "menu") return go({ view: "menu", topic: null });
    if (name === "dict") return go({ view: "dict", topic: null });
    if (name === "glossary") { G.sub = "all"; G.field = null; G.word = null; G.ret = null; return openGlossary({}); }
    if (name === "notes") return MW.notes ? MW.notes.close() : openNotesWin();
    if (name === "achievements") return MW.achievements ? MW.achievements.close() : WIN_VIEWS.achievements();
    if (name === "sidebar") { const b = $(".nav-fold"); if (b && b.offsetParent) b.click(); return; }
    if (name === "back") { if (Object.keys(MW).length) return closeWins(); const b = viewEl.querySelector(".back-row .btn-s:not(.navtoggle)"); if (b) b.click(); }
  }
};
window.addEventListener("inquire:signed-in", () => { mastered = loadMastered(); closeWins(); render(); }); // that account's progress and notes

/* ---------- boot ---------- */
$("#brand").onclick = () => go({ view: "menu", topic: null });
// Inquire Law always opens on the main menu (a link with #topic still opens that page directly).
const initial = fromHash() || { view: "menu" };
if (initial.g) { Object.assign(G, initial.g); delete initial.g; }
Object.assign(S, initial);
if (S.view === "math" && S.field !== "map" && !DB.fields[S.field]) S.field = DB.defaultField;
if (S.field !== "map" && DB.fields[S.field]) S.subject = subjOf(S.field);
if (!SM[S.subject]) S.subject = DB.defaultSubject;
if (S.topic && !NODE[S.topic]) S.topic = null;
if (S.gword) S.navMode = "glossary";
try { history.replaceState({ view: S.view, field: S.field, topic: S.topic, gword: S.gword }, ""); } catch(e){}
render();
})();
