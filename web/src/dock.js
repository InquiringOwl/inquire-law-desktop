/* Corner dock (layout of Oct 2026). Three icons (AI · Notes · Chat) sit in a small rail on the right edge of the app; the same
   three icons are in the Assist window's header, so every box can be reached from any other.
   - Assist window (#dk-win): "◆ Assist" at its top left with the tabs under it:
       AI chat: the model is NOT built in: set window.InquireAI before or after this file loads:
         window.InquireAI = { name: "Tutor", async ask({ messages, context }) { … return "reply text"; } }
         messages = [{ role: "user" | "assistant", content }], context = InquireApp.context() (view, subject, field, topic, topicTitle).
         ask may also return an async iterable of text chunks (streaming). Without a provider the chat says it is not connected.
       Chat: talk with other Inquire Law users. Needs an online server, which is not built; plug one in with
         window.InquireChat = { name, async send({ room, text, user }), subscribe(room, onMessage) → unsubscribe }
         onMessage({ user, text, time }). Without it the tab says it is not connected and the box is disabled.
   - Notes box (#dk-notes): its own window. Docked at the bottom right (left of Assist when both are open); drag its header to
     detach it and move it anywhere. ✕ closes it and the Notes icon reopens it where it was (floating or docked);
     ⇲ (or a double-click on the header) sends it home to the bottom right. Write notes, make one from the current topic page
     (InquireNotes.fromTopic), or clip selected page text. Phones (≤760 px): no dragging, and only one of the two boxes is open at a time.
   State in inqlaw.dock = { open, tab, notes: { open, float, x, y } } (x/y in CSS px of #app, which may be zoomed).
   Lives inside #app, so the sign-in screen and the settings window cover/fog it like the rest of the app. */
(function () {
"use strict";
const app = document.getElementById("app"); if (!app) return;
const NS = window.InquireNotes, A = () => window.InquireApp, esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const KEY = "inqlaw.dock";
const favTop = () => { try { return JSON.parse(localStorage.getItem("inqlaw.notefavtop") ?? "true") !== false; } catch (e) { return true; } }; // My notes → "★ first"
const st = (() => {
  let o = {}; try { o = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) {}
  const s = { open: !!o.open, tab: o.tab === "chat" ? "chat" : "ai", notes: Object.assign({ open: false, float: false, x: 0, y: 0 }, o.notes || {}) };
  if (o.tab === "notes") { s.notes.open = !!o.open; s.open = false; } // before Oct 2026 Notes was a tab of Assist
  return s;
})();
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

const ICON = {
  ai: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 2.5l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path fill="currentColor" d="M18.5 14.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/></svg>`,
  notes: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 14.5h7M9 18h4"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3 4.5h12v8.5H8.5L5 16v-3H3z"/><path d="M15 8.5h6V17h-2v3l-3.2-3H11v-4"/></svg>`
};
const icons = () => `<div class="dk-icons" role="group" aria-label="Assist tools">
  <button type="button" class="dk-ic" data-go="ai" title="AI assistant" aria-label="AI assistant" aria-pressed="false">${ICON.ai}</button>
  <button type="button" class="dk-ic" data-go="notes" title="Notes" aria-label="Notes" aria-pressed="false">${ICON.notes}</button>
  <button type="button" class="dk-ic" data-go="chat" title="Chat with other Inquire Law users" aria-label="Chat with other Inquire Law users" aria-pressed="false">${ICON.chat}</button></div>`;

const root = document.createElement("div");
root.className = "dk";
root.innerHTML = `
  <nav class="dk-rail" aria-label="Assist"><span class="dk-gem" aria-hidden="true"></span>${icons()}</nav>
  <section class="dk-win win" id="dk-win" role="dialog" aria-label="Assist" hidden>
    <header class="dk-h"><div class="dk-hl"><div class="dk-title"><span class="dk-gem" aria-hidden="true"></span>Assist</div>
      <div class="dk-tabs" role="tablist"><button type="button" role="tab" data-t="ai">AI chat</button><button type="button" role="tab" data-t="chat">Chat</button></div></div>
      <div class="dk-hr">${icons()}<button type="button" class="dk-x" aria-label="Close Assist" title="Close">✕</button></div></header>
    <div class="dk-pane" data-p="ai">
      <div class="dk-ctx"></div>
      <div class="dk-screen"><div class="dk-holo" aria-hidden="true"><span class="dk-scan"></span></div><div class="dk-log" aria-live="polite"></div></div>
      <form class="dk-ask"><textarea rows="2" placeholder="Ask about this topic…" aria-label="Message"></textarea><button type="submit" class="btn-s" aria-label="Send">Send</button></form>
    </div>
    <div class="dk-pane" data-p="chat" hidden>
      <div class="dk-ctx"><span>Room</span><b>General</b><span class="dk-prov dk-cprov">not connected</span></div>
      <div class="dk-screen"><div class="dk-holo" aria-hidden="true"><span class="dk-scan"></span></div><div class="dk-log dk-clog" aria-live="polite"></div></div>
      <form class="dk-ask dk-cask"><textarea rows="2" placeholder="Message other Inquire Law users…" aria-label="Message"></textarea><button type="submit" class="btn-s" aria-label="Send">Send</button></form>
    </div>
  </section>
  <section class="dkn win" id="dk-notes" role="dialog" aria-label="Notes" hidden>
    <header class="dkn-h" title="Drag to move · double-click to dock"><div class="dk-title"><span class="dk-gem" aria-hidden="true"></span>Notes</div><span class="dkn-grip" aria-hidden="true">⠿</span>
      <div class="dk-hr"><button type="button" class="dk-x dkn-home" aria-label="Dock Notes at the bottom right" title="Dock at the bottom right">⇲</button><button type="button" class="dk-x dkn-x" aria-label="Close Notes" title="Close">✕</button></div></header>
    <div class="dk-pane" data-p="notes"></div>
  </section>`;
app.appendChild(root);
const win = root.querySelector("#dk-win"), nwin = root.querySelector("#dk-notes"), nh = nwin.querySelector(".dkn-h");
const $ = s => root.querySelector(s);

// the rail steps aside while a docked box covers its corner; icons show which boxes are open
function sync() {
  root.classList.toggle("rail-off", st.open || (st.notes.open && !st.notes.float));
  root.querySelectorAll(".dk-ic").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.go === "notes" ? st.notes.open : st.open && st.tab === b.dataset.go)));
}

/* ---------- Assist window: slides out of the right edge and back ---------- */
let slideT = null;
function setOpen(o) {
  st.open = o; keep(); clearTimeout(slideT);
  if (o && phone() && st.notes.open) setNotes(false); // phones: one box at a time
  if (o) { win.hidden = false; void win.offsetWidth; root.classList.add("is-open"); setTab(st.tab); }
  else { root.classList.remove("is-open"); slideT = setTimeout(() => { if (!st.open) win.hidden = true; }, 380); }
  sync();
}
function setTab(t) {
  st.tab = t; keep();
  win.querySelectorAll(".dk-tabs [data-t]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.t === t)));
  win.querySelectorAll(".dk-pane").forEach(p => { p.hidden = p.dataset.p !== t; });
  if (t === "ai") { drawCtx(); setTimeout(() => $(".dk-ask textarea").focus({ preventScroll: true }), 30); }
  else drawChat();
  sync();
}
const railFocus = () => { const b = root.querySelector('.dk-rail [data-go="ai"]'); if (b && !root.classList.contains("rail-off")) b.focus(); };
root.addEventListener("click", e => {
  const b = e.target.closest(".dk-ic"); if (!b) return;
  const g = b.dataset.go;
  if (g === "notes") return setNotes(!st.notes.open);
  if (st.open && st.tab === g) setOpen(false);
  else { st.tab = g; if (st.open) setTab(g); else setOpen(true); }
});
win.querySelector(".dk-x").onclick = () => { setOpen(false); railFocus(); };
win.querySelectorAll(".dk-tabs [data-t]").forEach(b => b.onclick = () => setTab(b.dataset.t));
win.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); railFocus(); } });

/* ---------- AI chat ---------- */
const chat = []; // this session only
const ctx = () => (A() ? A().context() : {});
function drawCtx() {
  const c = ctx(), where = c.topicTitle || c.fieldName || c.subjectName || "";
  $(".dk-ctx").innerHTML = (c.view === "math" && where ? `<span>Context</span><b>${esc(where)}</b>` : `<span>Context</span><b>${c.view === "notes" ? "My notes" : c.view === "glossary" ? "Glossary" : "Menu"}</b>`)
    + `<span class="dk-prov">${window.InquireAI ? esc(window.InquireAI.name || "Assistant") : "not connected"}</span>`;
}
function bubble(role, text, log) {
  const d = document.createElement("div");
  d.className = "dk-msg " + role;
  d.innerHTML = `<div class="dk-t"></div>` + (role === "assistant" ? `<button type="button" class="dk-save" title="Save this reply to a note">＋ Note</button>` : "");
  d.querySelector(".dk-t").textContent = text;
  const sv = d.querySelector(".dk-save");
  if (sv) sv.onclick = () => { const c = ctx(); const n = NS.create({ title: "AI: " + (c.topicTitle || "notes"), body: d.querySelector(".dk-t").textContent, src: c.topic ? { topic: c.topic, title: c.topicTitle } : null }); sv.textContent = "Saved ✓"; sv.disabled = true; window.dispatchEvent(new CustomEvent("inquire:notes-changed", { detail: { id: n.id } })); };
  log = log || $(".dk-log"); log.appendChild(d); log.scrollTop = 1e9;
  return d;
}
function hello() {
  if ($(".dk-log").childElementCount) return;
  const p = document.createElement("p"); p.className = "dk-hello";
  p.textContent = window.InquireAI ? "Ask a question about the page you are on, or anything you are studying." : "The AI assistant is not connected yet. Its logic will be added in a later update; until then you can still write notes in the Notes box.";
  $(".dk-log").appendChild(p);
}
$(".dk-ask").onsubmit = async e => {
  e.preventDefault();
  const ta = $(".dk-ask textarea"), q = ta.value.trim(); if (!q) return;
  ta.value = ""; bubble("user", q); chat.push({ role: "user", content: q });
  const out = bubble("assistant", "…"), t = out.querySelector(".dk-t"); out.classList.add("busy");
  const P = window.InquireAI;
  try {
    if (!P || typeof P.ask !== "function") throw new Error("The AI assistant is not connected yet.");
    const r = await P.ask({ messages: chat.slice(), context: ctx() });
    let text = "";
    if (r && typeof r[Symbol.asyncIterator] === "function") { t.textContent = ""; for await (const ch of r) { text += ch; t.textContent = text; $(".dk-log").scrollTop = 1e9; } }
    else { text = String(r == null ? "" : r); t.textContent = text; }
    chat.push({ role: "assistant", content: text });
  } catch (err) { t.textContent = err.message || "Something went wrong."; out.classList.add("err"); }
  out.classList.remove("busy"); $(".dk-log").scrollTop = 1e9;
};
$(".dk-ask textarea").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $(".dk-ask").requestSubmit(); } });

/* ---------- Chat with other users (needs window.InquireChat) ---------- */
const clog = $(".dk-clog"), cask = $(".dk-cask"), cta = cask.querySelector("textarea");
let chatOff = null;
function cmsg(m, mine) {
  const d = document.createElement("div"); d.className = "dk-msg " + (mine ? "user" : "assistant");
  d.innerHTML = `${mine ? "" : `<b class="dk-who"></b>`}<div class="dk-t"></div>`;
  if (!mine) d.querySelector(".dk-who").textContent = m.user || "Someone";
  d.querySelector(".dk-t").textContent = m.text || "";
  clog.appendChild(d); clog.scrollTop = 1e9;
}
function drawChat() {
  const C = window.InquireChat, on = !!(C && typeof C.send === "function");
  $(".dk-cprov").textContent = on ? (C.name || "Online") : "not connected";
  cta.disabled = !on; cask.querySelector("button").disabled = !on;
  cta.placeholder = on ? "Message other Inquire Law users…" : "Chat is not connected yet";
  if (!on && !clog.childElementCount) clog.innerHTML = `<p class="dk-hello">Chat with other Inquire Law users is not connected yet. It needs Inquire Law’s online account server, which will come in a later update.</p>`;
  if (on && !chatOff && typeof C.subscribe === "function") { clog.innerHTML = ""; chatOff = C.subscribe("general", m => cmsg(m, false)) || (() => {}); }
  if (on) setTimeout(() => cta.focus({ preventScroll: true }), 30);
}
cask.onsubmit = async e => {
  e.preventDefault();
  const C = window.InquireChat, text = cta.value.trim(); if (!text || !C) return;
  cta.value = ""; cmsg({ text }, true);
  try { await C.send({ room: "general", text, user: window.InquireUserName || "" }); }
  catch (err) { const p = document.createElement("p"); p.className = "dk-hello"; p.textContent = "Not sent: " + (err.message || "the chat server did not answer."); clog.appendChild(p); }
};
cta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); cask.requestSubmit(); } });

/* ---------- Notes box: docked or floating, dragged by its header ---------- */
const zoom = () => app.currentCSSZoom || parseFloat(getComputedStyle(app).zoom) || 1;
const phone = () => matchMedia("(max-width:760px)").matches;
function place() {
  const fl = st.notes.float && !phone();
  nwin.classList.toggle("docked", !fl); nwin.classList.toggle("floating", fl);
  if (!fl) { nwin.style.left = nwin.style.top = ""; return; }
  const z = zoom(), W = innerWidth / z, H = innerHeight / z, w = nwin.offsetWidth || 380;
  st.notes.x = Math.round(Math.max(120 - w, Math.min(W - 120, st.notes.x))); // keep enough of the header on screen to grab
  st.notes.y = Math.round(Math.max(0, Math.min(H - 44, st.notes.y)));
  nwin.style.left = st.notes.x + "px"; nwin.style.top = st.notes.y + "px";
}
let closeT = null;
function setNotes(o) {
  st.notes.open = o; keep(); clearTimeout(closeT);
  if (o && phone() && st.open) setOpen(false);
  if (o) { nwin.hidden = false; place(); void nwin.offsetWidth; nwin.classList.add("is-open"); drawNotes(); }
  else { flush(); nwin.classList.remove("is-open"); closeT = setTimeout(() => { if (!st.notes.open) nwin.hidden = true; }, 240); }
  sync();
}
function dockHome() { st.notes.float = false; keep(); place(); sync(); }
nwin.querySelector(".dkn-x").onclick = () => { setNotes(false); railFocus(); };
nwin.querySelector(".dkn-home").onclick = dockHome;
nh.addEventListener("dblclick", e => { if (!e.target.closest("button")) dockHome(); });
nwin.addEventListener("keydown", e => { if (e.key === "Escape" && !e.target.closest(".nr-pop, .nv-pop")) { e.stopPropagation(); setNotes(false); railFocus(); } });
nh.addEventListener("pointerdown", e => {
  if (e.button !== 0 || e.target.closest("button") || phone()) return;
  e.preventDefault();
  const z = zoom(), r = nwin.getBoundingClientRect(), ox = (e.clientX - r.left) / z, oy = (e.clientY - r.top) / z;
  let moved = false;
  const move = ev => {
    if (!moved && Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) < 4) return; // a click is not a drag
    if (!moved) { moved = true; nwin.classList.add("dragging"); st.notes.float = true; sync(); }
    st.notes.x = ev.clientX / z - ox; st.notes.y = ev.clientY / z - oy; place();
  };
  const up = () => { nh.removeEventListener("pointermove", move); nh.removeEventListener("pointerup", up); nh.removeEventListener("pointercancel", up); nwin.classList.remove("dragging"); if (moved) keep(); };
  try { nh.setPointerCapture(e.pointerId); } catch (err) {}
  nh.addEventListener("pointermove", move); nh.addEventListener("pointerup", up); nh.addEventListener("pointercancel", up);
});
window.addEventListener("resize", () => { if (st.notes.open && st.notes.float) place(); });

let edId = null, saveT = null, rich = null;
function drawNotes() {
  const pane = nwin.querySelector('[data-p="notes"]');
  if (!NS) { pane.innerHTML = "<p class=dk-hello>Notes are unavailable.</p>"; return; }
  if (rich) { rich.destroy(); rich = null; }
  const n = edId && NS.get(edId);
  if (n) {
    pane.innerHTML = `<div class="dk-nbar"><button type="button" class="btn-s" data-a="back">◀ Notes</button><span class="dk-saved">Saved</span><button type="button" class="btn-s" data-a="photo" title="Add a photo from this computer">＋ Photo</button><button type="button" class="btn-s" data-a="clip" title="Add the text you have selected on the page">Clip selection</button><button type="button" class="btn-s warn" data-a="del" title="Delete this note">Delete</button></div>
      <input class="dk-ntitle" value="${esc(n.title)}" aria-label="Title" maxlength="140"><div class="dk-nbody"></div><input type="file" accept="image/*" multiple hidden>
      <div class="dk-nfoot">${n.src ? `<button type="button" class="dk-link" data-a="src">↗ ${esc(n.src.title)}</button>` : "<span></span>"}<button type="button" class="dk-link" data-a="full">Open in My notes ▸</button></div>`;
    const ti = pane.querySelector(".dk-ntitle"), sv = pane.querySelector(".dk-saved");
    rich = NS.mountEditor(pane.querySelector(".dk-nbody"), n.id, {
      onEditing: () => { sv.textContent = "Editing…"; }, onSaved: () => { sv.textContent = "Saved"; },
      openNote: id => { edId = id; drawNotes(); }, openTopic: id => A() && A().openTopic(id)
    });
    const saveTitle = () => { clearTimeout(saveT); sv.textContent = "Editing…"; saveT = setTimeout(() => { NS.update(n.id, { title: ti.value.trim() || "Untitled note" }); sv.textContent = "Saved"; saveT = null; }, 400); };
    ti.oninput = saveTitle;
    const file = pane.querySelector('input[type="file"]');
    pane.querySelector('[data-a="photo"]').onclick = () => file.click();
    file.onchange = async () => { const k = await rich.addFiles(file.files); sv.textContent = k ? "Photo added" : "That file is not a photo"; file.value = ""; };
    pane.querySelector('[data-a="back"]').onclick = () => { flush(); edId = null; drawNotes(); };
    pane.querySelector('[data-a="full"]').onclick = () => { flush(); const id = edId; edId = null; setNotes(false); A() && A().openNotes(id); };
    const src = pane.querySelector('[data-a="src"]'); if (src) src.onclick = () => A() && A().openTopic(n.src.topic);
    pane.querySelector('[data-a="del"]').onclick = () => { // at once, with Undo (like My notes)
      flush(); if (rich) { rich.destroy(); rich = null; } edId = null;
      NS.deleteWithUndo(n.id, id => { edId = id; if (st.notes.open) drawNotes(); }); drawNotes();
    };
    pane.querySelector('[data-a="clip"]').onmousedown = e => e.preventDefault(); // keep the page selection
    pane.querySelector('[data-a="clip"]').onclick = () => {
      const sel = String(window.getSelection ? window.getSelection() : "").trim(), c = ctx();
      if (!sel) { sv.textContent = "Select text on the page first"; return; }
      flush(); NS.appendQuote(n.id, sel, c.topic, c.topicTitle); drawNotes(); sv.textContent = "Clipped";
    };
    if (!n.body) rich.el.focus();
    return;
  }
  const c = ctx(), here = n => (A() && A().noteHere ? A().noteHere(n) : { score: 0 });
  // notes linked to the lesson, field or subject on screen come first (most specific first), then favourites, then the rest by last edit
  const all = NS.list().map(n => Object.assign(n, { _h: here(n) })).sort((a, b) => (b._h.score - a._h.score) || (favTop() ? b.fav - a.fav : 0) || (b.updated - a.updated));
  const nLinked = all.filter(n => n._h.score).length;
  const item = x => `<button type="button" class="dk-nit${x._h.score ? " here" : ""}" data-id="${x.id}"><b>${x.fav ? "★ " : ""}${esc(x.title)}</b>${x._h.score ? `<small class="dk-nhere">Linked to ${esc(x._h.label)}</small>` : ""}<span>${esc(x.body.slice(0, 90))}</span></button>`;
  const list = all.slice(0, Math.max(30, nLinked));
  pane.innerHTML = `<div class="dk-nbar"><button type="button" class="btn-s" data-a="new">＋ New</button><button type="button" class="btn-s" data-a="gen"${c.topic ? "" : " disabled"} title="${c.topic ? "Make a study note from " + esc(c.topicTitle) : "Open a topic page first"}">Note from this page</button></div>
    <div class="dk-nlist">${all.length ? (nLinked ? `<p class="dk-nh">Linked to this page · ${nLinked}</p>` + list.slice(0, nLinked).map(item).join("") + (list.length > nLinked ? `<p class="dk-nh">Other notes</p>` : "") + list.slice(nLinked).map(item).join("") : list.map(item).join("")) : `<p class="dk-hello">No notes yet. Start one, or open a topic and choose <b>Note from this page</b> for a ready-made study sheet you can add to.</p>`}</div>
    <div class="dk-nfoot"><span>${all.length} note${all.length === 1 ? "" : "s"}</span><button type="button" class="dk-link" data-a="full">Open in My notes ▸</button></div>`;
  pane.querySelector('[data-a="new"]').onclick = () => { const x = NS.create({ src: c.topic ? { topic: c.topic, title: c.topicTitle } : null }); edId = x.id; drawNotes(); pane.querySelector(".dk-ntitle").select(); };
  pane.querySelector('[data-a="gen"]').onclick = () => {
    const g = NS.fromTopic(c.topic); if (!g) return; const x = NS.create(g); edId = x.id; drawNotes();
    const ed = pane.querySelector(".nb-rich"); ed.focus(); const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); ed.scrollTop = 1e9;
  };
  pane.querySelector('[data-a="full"]').onclick = () => { setNotes(false); A() && A().openNotes(); };
  pane.querySelectorAll(".dk-nit").forEach(b => b.onclick = () => { edId = b.dataset.id; drawNotes(); });
}
function flush() {
  if (rich) rich.flush();
  if (!saveT) return; clearTimeout(saveT); saveT = null; const ti = nwin.querySelector(".dk-ntitle"); if (ti && edId) NS.update(edId, { title: ti.value.trim() || "Untitled note" });
}

// keep the context line and the notes list current
const refresh = () => { if (!win.hidden && st.tab === "ai") drawCtx(); if (!nwin.hidden && !edId) drawNotes(); };
window.addEventListener("hashchange", refresh);
window.addEventListener("inquire:route", refresh);
window.addEventListener("inquire:notes-changed", () => { if (!nwin.hidden && !edId) drawNotes(); });
window.addEventListener("inquire:signed-in", () => {
  edId = null; chat.length = 0; $(".dk-log").innerHTML = ""; hello();
  if (chatOff) { try { chatOff(); } catch (e) {} chatOff = null; } clog.innerHTML = "";
  if (!win.hidden) setTab(st.tab); if (!nwin.hidden) drawNotes();
});
window.InquireDock = { open: t => { st.tab = t === "chat" ? "chat" : "ai"; setOpen(true); }, close: () => setOpen(false), notes: setNotes, dockNotes: dockHome, state: () => JSON.parse(JSON.stringify(st)) };
hello();
if (st.open) setOpen(true);
if (st.notes.open) setNotes(true);
sync();
})();
