/* Intro / sign-in screen. Plays once per launch in the desktop app (or any page opened with ?intro).
   Sequence: background fades in and drifts, neurons fire, logo fades in slowly, then the sign-in form appears.
   Background: app/intro/inq-intro.webm or .mp4 (looping, muted) when present; otherwise the still plate plus the neuron sparks drawn
   here on a canvas. The logo and form are always live elements on top, never part of the video.
   Accounts are LOCAL to this computer (PBKDF2-hashed password in localStorage). There is no server, so no password reset. */
(function () {
"use strict";
const desktop = !!window.inquireDesktop;
const wanted = desktop || /[?&]intro\b/.test(location.search);
const appEl = document.getElementById("app");
const who = document.getElementById("whoami");
if (!wanted || !appEl) { if (who) who.hidden = true; return; }

const SET = (() => { try { return JSON.parse(localStorage.getItem("inqlaw.settings") || "{}"); } catch (e) { return {}; } })(); // Settings → Display
const reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) || !!SET.reduceMotion;
const quick = SET.playIntro === false; // intro off: form at once, background still alive

/* Links in the corner of the sign-in screen. An empty url shows the icon dimmed as "coming soon".
   Discord needs a permanent server invite (Server Settings → Invites, or Invite People → Edit link → Expire: Never),
   e.g. "https://discord.gg/AbCdEf". Icons are generic glyphs; swap in the brands' official marks from their press kits if wanted. */
const SOCIAL = [
  { id: "discord", label: "Discord", url: "https://discord.gg/FdnWNnAKBA", icon: '<path d="M4 5h16v10H9l-5 4z"/><circle cx="9.5" cy="10" r="1"/><circle cx="14.5" cy="10" r="1"/>' },
  { id: "github", label: "GitHub", url: "https://github.com/InquiringOwl/inquire-law-desktop", icon: '<path d="M8 7 3 12l5 5M16 7l5 5-5 5M13.5 4l-3 16"/>' },
  { id: "instagram", label: "Instagram", url: "", icon: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r=".8"/>' },
  { id: "tiktok", label: "TikTok", url: "", icon: '<path d="M14 4v11a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 4c.5 2.5 2.5 4 5 4"/>' }
];
const socialHtml = SOCIAL.map(s => s.url
  ? `<a class="inqi-soc" href="${s.url}" target="_blank" rel="noopener" aria-label="${s.label}" title="${s.label}"><svg viewBox="0 0 24 24" aria-hidden="true">${s.icon}</svg></a>`
  : `<span class="inqi-soc off" role="img" aria-label="${s.label}: coming soon" title="${s.label}: coming soon"><svg viewBox="0 0 24 24" aria-hidden="true">${s.icon}</svg></span>`).join("");
const ACC_KEY = "inqlaw.accounts", REM_KEY = "inqlaw.rememberedUser";
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ---------- local accounts ---------- */
const canCrypto = !!(window.crypto && crypto.subtle);
const b64 = u8 => btoa(String.fromCharCode.apply(null, u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function derive(pw, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 210000 }, key, 256);
  return b64(new Uint8Array(bits));
}
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const nameOk = u => /^[A-Za-z0-9_.-]{3,24}$/.test(u);
const accounts = () => ls.get(ACC_KEY, {});
// display = the person's proper name, used by Inquire Law (and later its AI) to address them; older accounts fall back to the username
const displayOf = user => { const a = accounts()[String(user).toLowerCase()]; return (a && a.display) || (a ? a.name : user); };
const cleanName = n => String(n || "").replace(/\s+/g, " ").trim();
async function createAccount(user, pw, display) {
  const all = accounts(), id = user.toLowerCase();
  if (all[id]) throw new Error("That username is taken on this computer.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  all[id] = { name: user, display: cleanName(display), salt: b64(salt), hash: await derive(pw, salt), created: Date.now() };
  ls.set(ACC_KEY, all);
  return all[id].name;
}
let failures = 0;
async function checkLogin(user, pw) {
  if (failures >= 3) await new Promise(r => setTimeout(r, Math.min(failures - 2, 6) * 1000)); // slow down guessing
  const a = accounts()[user.toLowerCase()];
  const hash = await derive(pw, a ? unb64(a.salt) : new Uint8Array(16)); // same work either way
  if (!a || !same(hash, a.hash)) { failures++; throw new Error("Username or password not recognised."); }
  failures = 0;
  return a.name;
}

/* ---------- markup ---------- */
const root = document.createElement("div");
root.className = "inqi";
root.id = "inqi";
root.setAttribute("role", "dialog");
root.setAttribute("aria-modal", "true");
root.setAttribute("aria-label", "Sign in to Inquire Law");
root.innerHTML = `
  <div class="inqi-world" aria-hidden="true">
    <div class="inqi-plate"></div>
    <video class="inqi-video" muted loop playsinline preload="auto" tabindex="-1"></video>
    <canvas class="inqi-fx"></canvas>
  </div>
  <div class="inqi-shade" aria-hidden="true"></div>
  <div class="inqi-stage">
    <div class="inqi-brand"><img class="inqi-logo" src="intro/inq-lockup.png" alt="Inquire Law"><span class="inqi-sub" aria-hidden="true">Law</span></div>
    <form class="inqi-form" novalidate>
      <div class="inqi-tabs" role="tablist">
        <button type="button" class="inqi-tab" role="tab" id="tab-in" aria-selected="true" data-mode="in">Sign in</button>
        <button type="button" class="inqi-tab" role="tab" id="tab-up" aria-selected="false" data-mode="up">Create account</button>
      </div>
      <label class="inqi-field" data-up hidden><span>Name</span><input name="n" type="text" autocomplete="name" maxlength="40" placeholder="What Inquire Law should call you"></label>
      <label class="inqi-field"><span>Username</span><input name="u" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="24" required></label>
      <label class="inqi-field"><span>Password</span><input name="p" type="password" autocomplete="current-password" required></label>
      <label class="inqi-field" data-up hidden><span>Confirm password</span><input name="p2" type="password" autocomplete="new-password"></label>
      <label class="inqi-check"><input name="r" type="checkbox"> Remember my username</label>
      <button type="submit" class="inqi-go">Sign in</button>
      <p class="inqi-msg" role="alert" aria-live="polite"></p>
      <p class="inqi-note">Accounts live on this computer only.<span data-up hidden> Creating an account means you accept the <button type="button" class="inqi-lnk" data-doc="eula">licence agreement</button>.</span></p>
      <div class="inqi-unlock" aria-hidden="true">
        <svg class="inqi-lock" viewBox="0 0 120 140"><defs><linearGradient id="inqi-lk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9F4FF"/><stop offset=".55" stop-color="#9FB3C8"/><stop offset="1" stop-color="#5D6F86"/></linearGradient></defs>
          <circle class="inqi-ring" cx="60" cy="84" r="54"/>
          <path class="inqi-shackle" d="M34 66 V42 a26 26 0 0 1 52 0 V66"/>
          <rect class="inqi-body" x="22" y="62" width="76" height="62" rx="7"/>
          <path class="inqi-hole" d="M60 82 a8 8 0 0 1 5 14.2 L68 110 H52 L55 96.2 A8 8 0 0 1 60 82z"/>
          <path class="inqi-glint" d="M28 70 H92"/></svg>
        <p class="inqi-welcome">Welcome, <b></b></p>
      </div>
      <div class="inqi-links"><button type="button" class="inqi-lnk" data-open="settings"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>Settings</button><button type="button" class="inqi-lnk" data-doc="eula">EULA</button></div>
    </form>
  </div>
  <nav class="inqi-corner" aria-label="Inquire Law online">${socialHtml}</nav>
  <button type="button" class="inqi-skip">Skip intro</button>`;
document.body.appendChild(root);
appEl.inert = true;
if (who) who.hidden = true;

const $ = s => root.querySelector(s);
const form = $(".inqi-form"), msg = $(".inqi-msg"), go = $(".inqi-go");
const inN = form.elements.n, inU = form.elements.u, inP = form.elements.p, inP2 = form.elements.p2, inR = form.elements.r;
let mode = "in", done = false, fxStop = null;

/* ---------- sequence ---------- */
const timers = [];
const at = (ms, fn) => timers.push(setTimeout(fn, ms));
function showForm() {
  root.classList.add("is-bg", "is-logo", "is-form");
  setTimeout(() => (inU.value ? inP : inU).focus({ preventScroll: true }), reduced ? 0 : 900);
}
function play() {
  if (reduced || quick) { root.classList.add("is-fast"); showForm(); startFx(); if (quick && !reduced) setTimeout(() => root.classList.remove("is-fast"), 60); return; }
  at(150, () => root.classList.add("is-bg"));
  at(900, startFx);
  at(2600, () => root.classList.add("is-logo"));
  at(6400, showForm);
}
function skip() {
  if (root.classList.contains("is-form")) return;
  timers.forEach(clearTimeout);
  root.classList.add("is-fast");
  showForm(); startFx();
  setTimeout(() => root.classList.remove("is-fast"), 60);
}
$(".inqi-skip").addEventListener("click", skip);
document.addEventListener("keydown", e => { if (!done && !root.hidden && !root.classList.contains("is-form") && e.key !== "Tab") skip(); });
root.addEventListener("pointerdown", e => { if (!e.target.closest(".inqi-form,.inqi-skip,.inqi-corner")) skip(); });
root.querySelectorAll("[data-open=settings]").forEach(b => b.addEventListener("click", () => window.InquireSettings && InquireSettings.open()));
root.querySelectorAll("[data-doc]").forEach(b => b.addEventListener("click", () => window.InquireSettings && InquireSettings.openDoc(b.dataset.doc)));

/* ---------- form ---------- */
function setMode(m) {
  mode = m;
  root.querySelectorAll(".inqi-tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.mode === m)));
  form.querySelectorAll("[data-up]").forEach(el => { el.hidden = m !== "up"; });
  inP2.required = m === "up";
  inP.autocomplete = m === "up" ? "new-password" : "current-password";
  go.textContent = m === "up" ? "Create account" : "Sign in";
  setMsg("");
  (m === "up" ? inN : inU).focus({ preventScroll: true });
}
root.querySelectorAll(".inqi-tab").forEach(t => t.addEventListener("click", () => setMode(t.dataset.mode)));
function setMsg(t, ok) { msg.textContent = t; msg.classList.toggle("ok", !!ok); [inU, inP, inP2].forEach(i => i.removeAttribute("aria-invalid")); }
function bad(input, t) { setMsg(t); input.setAttribute("aria-invalid", "true"); input.focus(); return false; }
function validate() {
  const u = inU.value.trim();
  if (!u) return bad(inU, "Enter your username.");
  if (mode === "up" && !cleanName(inN.value)) return bad(inN, "Enter your name, so Inquire Law knows what to call you.");
  if (mode === "up" && !nameOk(u)) return bad(inU, "Use 3–24 letters, numbers, dots, dashes or underscores.");
  if (!inP.value) return bad(inP, "Enter your password.");
  if (mode === "up") {
    if (inP.value.length < 8) return bad(inP, "Use at least 8 characters for the password.");
    if (inP.value !== inP2.value) return bad(inP2, "The two passwords do not match.");
  }
  return true;
}
form.addEventListener("submit", async e => {
  e.preventDefault();
  if (!canCrypto) return setMsg("This window cannot protect passwords, so accounts are unavailable.");
  if (!validate()) return;
  primeAudio();
  go.disabled = true;
  try {
    const u = inU.value.trim();
    const name = mode === "up" ? await createAccount(u, inP.value, inN.value) : await checkLogin(u, inP.value);
    if (inR.checked) ls.set(REM_KEY, name); else ls.del(REM_KEY); // the account's real username (its own capitals)
    inP.value = inP2.value = ""; inN.value = "";
    await unlock(displayOf(name));
    enter(name);
  } catch (err) {
    setMsg(err.message || "Something went wrong. Try again.");
    inP.select();
  } finally { go.disabled = false; }
});

/* Unlock moment after a correct sign-in: the form's contents fade, a lock opens, "Welcome, <name>" appears, then the app.
   Timeline (ms from the click): fade 0–450, lock in 300–750, shackle opens at UNLOCK.open, welcome from 1300, app at UNLOCK.done.
   "inquire:unlock" fires at the start with these times, so sound can be scheduled to match (see Settings → sound, later). */
const UNLOCK = { lockIn: 300, open: 1150, welcome: 1300, done: 2300 };

/* Unlock sound: a soft ambient swell, synthesised live with Web Audio (no file), so it starts on the same frame as the animation.
   Only sine and triangle tones through a gentle low-pass and a generated reverb. The pitch keeps the "opening" shape:
   a low tone glides quickly to a mid tone, then the rise slows and drags up to a high tone that lands as the shackle opens
   (UNLOCK.open), with a soft gliding bell layered on top; a quiet, bell-like chord then blooms and fades. Off with Settings → Display → Sound effects.
   unlockSound(ac, t0) works on any BaseAudioContext, so it can also be rendered offline to a file for review. */
function unlockSound(ac, t0) {
  const T = UNLOCK.open / 1000, END = UNLOCK.done / 1000;   // the sound lasts exactly as long as the lock animation
  const LOW = 110, MID = 220, HIGH = 660, QUICK = .22;   // A2 → A3, easing up to E5
  const N = 400, curve = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1) * T;
    if (t < QUICK) { const u = t / QUICK; curve[i] = LOW * Math.pow(MID / LOW, 1 - Math.pow(1 - u, 2)); }
    else { const u = (t - QUICK) / (T - QUICK); curve[i] = MID * Math.pow(HIGH / MID, 1 - Math.pow(1 - u, 2.4)); }
  }
  // master: soft low-pass, then a dry/wet split into a generated reverb (decaying stereo noise)
  const master = ac.createGain(); master.gain.value = 1.5;
  { // smooth fade-out: a raised-cosine curve from just after the open to the end of the animation (no sudden drop at either end)
    const F0 = T + .12, n = 128, fade = new Float32Array(n);
    for (let i = 0; i < n; i++) fade[i] = 1.5 * Math.pow(.5 * (1 + Math.cos(Math.PI * i / (n - 1))), 1.6);
    master.gain.setValueCurveAtTime(fade, t0 + F0, END - F0);
  }
  const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1500; lp.Q.value = .5;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = .02; comp.release.value = .3;
  master.connect(lp); lp.connect(comp); comp.connect(ac.destination);
  const rev = ac.createConvolver(), wet = ac.createGain(); wet.gain.value = .55;
  const rl = Math.ceil(ac.sampleRate * 2.6), ir = ac.createBuffer(2, rl, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let k = 0; k < rl; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / rl, 3.2); }
  rev.buffer = ir; rev.connect(wet); wet.connect(master);
  const bus = ac.createGain(); bus.connect(master); bus.connect(rev);
  const pan = (node, p) => { if (!ac.createStereoPanner) return node; const sp = ac.createStereoPanner(); sp.pan.value = p; node.connect(sp); return sp; };

  // gliding pad: the tone, a soft fifth above, a gentle octave below; slightly detuned for a slow shimmer
  const pad = ac.createGain();
  pad.gain.setValueAtTime(0, t0); pad.gain.linearRampToValueAtTime(.132, t0 + .28); pad.gain.linearRampToValueAtTime(.156, t0 + T);   // pad 40% under the first version
  pad.gain.setTargetAtTime(0, t0 + T + .05, .35);
  const trem = ac.createGain(); trem.gain.value = .9; pad.connect(trem); trem.connect(bus);
  [[1, "sine", 0, .5, -.25], [1, "triangle", 7, .22, .25], [1.5, "sine", -5, .16, .35], [.5, "sine", 0, .3, 0]].forEach(([mult, type, cents, g, p]) => {
    const o = ac.createOscillator(), v = ac.createGain(); o.type = type; o.detune.value = cents; v.gain.value = g;
    o.frequency.setValueCurveAtTime(mult === 1 ? curve : curve.map(f => f * mult), t0, T);
    // (no setValueAtTime after the curve: the curve holds its last value, and a call at its end time throws in live contexts)
    o.connect(v); pan(v, p).connect(pad); o.start(t0); o.stop(t0 + END + .15);
  });
  // slow tremolo on the pad (a breath, not a wobble)
  const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 3.2; lg.gain.value = .1;
  lfo.connect(lg); lg.connect(trem.gain); lfo.start(t0); lfo.stop(t0 + END + .15);

  // soft bell layer: struck like a felt mallet chime, gliding on the same pitch curve and octave as the pad.
  // Strikes come quickly at first and space out as the climb slows; the last one lands as the shackle opens.
  const strikes = [0, .1, .21, .34, .49, .66, .86, T];
  [[1, .045, .75], [2, .016, .45], [3, .0035, .26], [4.07, .0015, .16]].forEach(([mult, g, tau], k) => {
    const o = ac.createOscillator(), v = ac.createGain(); o.type = "sine"; v.gain.value = 0;
    o.frequency.setValueCurveAtTime(mult === 1 ? curve : curve.map(f => f * mult), t0, T);
    // (no setValueAtTime after the curve: the curve holds its last value, and a call at its end time throws in live contexts)
    strikes.forEach((st, n) => {
      const at = t0 + .02 + st, peak = g * (n === strikes.length - 1 ? 1.15 : .75 + .25 * n / strikes.length);
      v.gain.setTargetAtTime(peak, at, .006);                         // soft mallet: ~20 ms rise, no click
      v.gain.setTargetAtTime(0, at + .03, tau * (n === strikes.length - 1 ? 3 : 1));
    });
    o.connect(v); pan(v, k % 2 ? .12 : -.12).connect(bus); o.start(t0); o.stop(t0 + END + .15);
  });
  // the open: a quiet bell-like chord on the high tone (E5, B5, E6, G#6), each partial fading at its own pace
  [[HIGH, .04, 1.1, -.3], [HIGH * 1.5, .028, .9, .3], [HIGH * 2, .018, .7, -.15], [HIGH * 2.52, .01, .6, .2]].forEach(([f, g, tau, p], k) => {
    const o = ac.createOscillator(), v = ac.createGain(); o.type = "sine"; o.frequency.value = f; v.gain.value = 0;
    const at = t0 + T + k * .045;                          // a soft strum, low to high
    v.gain.setValueAtTime(0, at); v.gain.linearRampToValueAtTime(g, at + .06); v.gain.setTargetAtTime(0, at + .08, tau * .5);
    o.connect(v); pan(v, p).connect(bus); o.start(at - .01); o.stop(t0 + END + .15);
  });
  return END;
}
window.InquireUnlockSound = unlockSound; // used by tools to render a preview file
let actx = null, soundOn = false;
function primeAudio() { // called inside the click, so the browser allows sound
  const cur = window.InquireSettings ? window.InquireSettings.get() : SET;
  soundOn = cur.soundFx !== false;
  if (!soundOn || !(window.AudioContext || window.webkitAudioContext)) return;
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch (e) { actx = null; }
}
function unlock(display) {
  const box = $(".inqi-unlock");
  box.querySelector(".inqi-welcome b").textContent = display;
  box.setAttribute("aria-hidden", "false");
  setMsg("");
  msg.textContent = "Welcome, " + display + ".";   // for screen readers (the visible text is in the lock panel)
  msg.classList.add("sr");
  window.dispatchEvent(new CustomEvent("inquire:unlock", { detail: Object.assign({ name: display, reduced }, UNLOCK) }));
  form.classList.add("is-unlocking");
  if (actx && soundOn) try { unlockSound(actx, actx.currentTime + .01); } catch (e) { console.warn("unlock sound:", e); }
  const T = reduced ? { open: 0, done: 1200 } : UNLOCK;
  setTimeout(() => form.classList.add("is-open"), T.open);
  return new Promise(r => setTimeout(r, T.done));
}

function enter(name) {
  done = true;
  window.InquireUser = name;
  window.InquireUserName = displayOf(name);
  if (who) { who.textContent = window.InquireUserName + " · sign out"; who.hidden = false; who.setAttribute("aria-label", "Signed in as " + window.InquireUserName + ". Sign out"); }
  root.classList.add("is-leaving");
  appEl.inert = false;
  setTimeout(() => { root.hidden = true; if (fxStop) fxStop(); const v = $(".inqi-video"); try { v.pause(); } catch (e) {} const view = document.getElementById("view"); if (view) view.focus({ preventScroll: true }); }, 950);
  window.dispatchEvent(new CustomEvent("inquire:signed-in", { detail: { user: name } }));
}
function signOut() {
  delete window.InquireUser; delete window.InquireUserName; if (who) who.hidden = true;
  form.classList.remove("is-unlocking", "is-open"); $(".inqi-unlock").setAttribute("aria-hidden", "true"); msg.classList.remove("sr"); setMsg("");
  appEl.inert = true; root.hidden = false; root.classList.remove("is-leaving");
  setMode("in"); fillRemembered(); done = false;
  const v = $(".inqi-video"); try { if (root.classList.contains("has-video")) v.play(); } catch (e) {}
  startFx(); (inU.value ? inP : inU).focus();
}
if (who) who.addEventListener("click", signOut);

/* account tools for Settings → Account */
async function changePassword(oldPw, newPw) {
  const name = window.InquireUser; if (!name) throw new Error("Nobody is signed in.");
  await checkLogin(name, oldPw).catch(() => { throw new Error("The current password is not right."); });
  const all = accounts(), id = name.toLowerCase(), salt = crypto.getRandomValues(new Uint8Array(16));
  all[id] = Object.assign({}, all[id], { salt: b64(salt), hash: await derive(newPw, salt), changed: Date.now() });
  ls.set(ACC_KEY, all);
}
async function removeAccount(pw) {
  const name = window.InquireUser; if (!name) throw new Error("Nobody is signed in.");
  await checkLogin(name, pw).catch(() => { throw new Error("The password is not right."); });
  const all = accounts(); delete all[name.toLowerCase()]; ls.set(ACC_KEY, all);
  if (window.InquireKeys) { const k = InquireKeys.forUser(name); ls.del(k.progress); ls.del(k.notes); ls.del("inqlaw.achievements." + String(name).toLowerCase()); } // the account's own progress and notes go with it
  if ((ls.get(REM_KEY, "") || "").toLowerCase() === name.toLowerCase()) ls.del(REM_KEY);
  signOut();
}
function rename(display) {
  const name = window.InquireUser, n = cleanName(display); if (!name) throw new Error("Nobody is signed in.");
  if (!n) throw new Error("Enter a name.");
  const all = accounts(), id = name.toLowerCase(); all[id] = Object.assign({}, all[id], { display: n }); ls.set(ACC_KEY, all);
  window.InquireUserName = n; if (who) { who.textContent = n + " · sign out"; who.setAttribute("aria-label", "Signed in as " + n + ". Sign out"); }
  window.dispatchEvent(new CustomEvent("inquire:name-changed", { detail: { name: n } }));
}
window.InquireAccounts = { changePassword, remove: removeAccount, signOut, rename, displayName: () => window.InquireUserName || window.InquireUser || "" };

/* ---------- background video (optional) ---------- */
// Drop app/intro/inq-intro.webm and/or inq-intro.mp4 into the app and it is used automatically; with neither file the still plate + sparks play.
(function tryVideo() {
  if (reduced) return; // reduced motion: keep the still plate
  const v = $(".inqi-video"); let missing = 0;
  const kinds = [["inq-intro.webm", "video/webm"], ["inq-intro.mp4", "video/mp4"]];
  kinds.forEach(([file, type]) => {
    const s = document.createElement("source"); s.type = type; s.src = "intro/" + file;
    s.addEventListener("error", () => { if (++missing === kinds.length) root.classList.remove("has-video"); });
    v.appendChild(s);
  });
  v.addEventListener("canplay", () => { root.classList.add("has-video"); if (fxStop) fxStop(); v.play().catch(() => {}); }, { once: true });
  v.load();
})();

/* ---------- neuron sparks (used while there is no video) ---------- */
// Positions are in the 1672×941 source image; the plate is drawn "cover", so they are mapped the same way.
const IW = 1672, IH = 941;
const NODES = [[100, 322], [215, 415], [205, 385], [385, 235], [330, 215], [60, 290], [250, 150], [470, 175], [150, 520], [520, 640],
  [620, 700], [870, 705], [1250, 650], [1330, 520], [1385, 598], [1497, 688], [1545, 645], [1600, 720], [1450, 470], [1620, 420]];
let edges = null;
function buildEdges(rng) {
  const E = [];
  NODES.forEach((a, i) => {
    NODES.map((b, j) => ({ j, d: Math.hypot(a[0] - b[0], a[1] - b[1]) })).filter(o => o.j !== i && o.d < 420).sort((p, q) => p.d - q.d).slice(0, 2).forEach(o => {
      if (E.some(e => (e.a === i && e.b === o.j) || (e.a === o.j && e.b === i))) return;
      const b = NODES[o.j], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = -(b[1] - a[1]), ny = b[0] - a[0], k = (rng() - .5) * .5;
      E.push({ a: i, b: o.j, cx: mx + nx * k, cy: my + ny * k });
    });
  });
  return E;
}
function startFx() {
  if (fxStop || reduced || root.classList.contains("has-video")) return;
  const cv = $(".inqi-fx"), cx = cv.getContext("2d");
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0, next = 0, alive = true;
  const fires = [], sigs = [];
  const rnd = () => Math.random();
  if (!edges) edges = buildEdges(rnd);
  const size = () => { dpr = Math.min(window.devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
  size(); addEventListener("resize", size);
  const map = (x, y) => { const s = Math.max(W / IW, H / IH); return [x * s + (W - IW * s) / 2, y * s + (H - IH * s) / 2, s]; };
  const bez = (e, t) => { const a = NODES[e.a], b = NODES[e.b], u = 1 - t; return [u * u * a[0] + 2 * u * t * e.cx + t * t * b[0], u * u * a[1] + 2 * u * t * e.cy + t * t * b[1]]; };
  function fire(i, amp, now) { fires.push({ i, t0: now, dur: 1300 + rnd() * 700, amp }); }
  function spawn(now) {
    const i = Math.floor(rnd() * NODES.length);
    fire(i, .5 + rnd() * .4, now);
    const out = edges.filter(e => e.a === i || e.b === i).sort(() => rnd() - .5).slice(0, 1 + (rnd() < .4));
    out.forEach(e => sigs.push({ e, fwd: e.a === i, t0: now + 120, dur: 900 + rnd() * 900, hit: false }));
  }
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    if (now >= next) { spawn(now); next = now + 380 + rnd() * 1100; }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
    cx.globalCompositeOperation = "lighter"; cx.lineCap = "round";
    for (let k = sigs.length - 1; k >= 0; k--) {
      const s = sigs[k], p = (now - s.t0) / s.dur;
      if (p < 0) continue;
      if (p >= 1) { if (!s.hit) fire(s.fwd ? s.e.b : s.e.a, .45, now); sigs.splice(k, 1); continue; }
      const t1 = s.fwd ? p : 1 - p, tail = s.fwd ? Math.max(0, p - .22) : Math.min(1, 1 - p + .22);
      const env = Math.sin(Math.PI * p);
      cx.beginPath();
      for (let n = 0; n <= 10; n++) { const t = tail + (t1 - tail) * n / 10, q = bez(s.e, t), m = map(q[0], q[1]); n ? cx.lineTo(m[0], m[1]) : cx.moveTo(m[0], m[1]); }
      const sc = map(0, 0)[2];
      cx.strokeStyle = `rgba(160,235,255,${.55 * env})`; cx.lineWidth = Math.max(1, 1.5 * sc); cx.shadowColor = "rgba(92,200,224,.9)"; cx.shadowBlur = 8 * sc; cx.stroke();
    }
    cx.shadowBlur = 0;
    for (let k = fires.length - 1; k >= 0; k--) {
      const f = fires[k], p = (now - f.t0) / f.dur;
      if (p >= 1) { fires.splice(k, 1); continue; }
      const env = p < .18 ? p / .18 : Math.pow(1 - (p - .18) / .82, 1.6);
      const m = map(NODES[f.i][0], NODES[f.i][1]), r = (26 + 30 * env) * m[2] * 1.4;
      const g = cx.createRadialGradient(m[0], m[1], 0, m[0], m[1], r);
      g.addColorStop(0, `rgba(230,250,255,${.7 * f.amp * env})`); g.addColorStop(.25, `rgba(110,215,245,${.4 * f.amp * env})`); g.addColorStop(1, "rgba(60,150,220,0)");
      cx.fillStyle = g; cx.beginPath(); cx.arc(m[0], m[1], r, 0, 7); cx.fill();
    }
  }
  raf = requestAnimationFrame(t => { last = t; next = t + 300; frame(t); });
  fxStop = () => { alive = false; cancelAnimationFrame(raf); removeEventListener("resize", size); cx.clearRect(0, 0, W, H); fxStop = null; };
}

/* ---------- go ---------- */
/* "Remember my username": kept in inqlaw.rememberedUser until the box is unticked (signing out keeps it).
   Unticking forgets it at once; ticking with a username typed remembers it at once (sign-in then stores the account's own spelling). */
function fillRemembered() {
  const r = ls.get(REM_KEY, "");
  inU.value = r || ""; inR.checked = !!r;
}
inR.addEventListener("change", () => {
  const u = inU.value.trim();
  if (!inR.checked) ls.del(REM_KEY); else if (u) ls.set(REM_KEY, u);
});
fillRemembered();
window.InquireIntro = { skip, isOpen: () => !done };
play();
})();
