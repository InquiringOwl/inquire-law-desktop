# Inquire Law (desktop)

Inquire Law is a knowledge console for law school that maps each subject as a skill tree. It is built on the Inquire 1.19.0 interface (dictionary, field maps, skill trees, Concept · Intermediate · Formal lessons, notes, glossary, achievements, settings, Assist dock) with none of Inquire's content. Today it holds the Law subjects as locked (not yet charted) names and one **Lesson Template** subject that shows the lesson format with placeholder text.

- **Repo (public, to be created):** `InquiringOwl/inquire-law-desktop`. Installed copies check its Releases at launch and every 4 hours.
- Separate from Inquire: own app ID (`com.wolfiescoven.inquirelaw`), `inqlaw://` scheme, `inqlaw.*` storage keys and data folder, so accounts, progress and notes never mix.

## Project layout

| Path | What it is |
| --- | --- |
| `web/src/` | App code: `data.js` (subjects, fields, trees, menu slides), `app.js` (menus, dictionary, maps, trees, lessons, glossary), notes, dock, settings, sign-in, achievements |
| `web/content/<field>/` | Lessons, one file per lesson (`ARITH["id"] = {…}`); start from `template-field/lesson-template.js` |
| `web/labs/` | Interactive models, one per lesson (`LABS["id"]`) |
| `web/kits/` | Lab kits shared by every model |
| `docs/subjects/LAYERS.md` | The lesson format spec; skeleton in `docs/subjects/LESSON-TEMPLATE.js` |
| `tools/` | `build-web.js`, `validate.js`, `labtest.js`, `smoke.js`, `interact.js`, `release.js`, … (`npm run check` runs the checks) |
| `main.js`, `preload.js`, `updater-mac.js` | Electron shell, `inqlaw://` scheme, updates |
| `CLAUDE.md` | Working brief for Claude sessions |

## First-time setup

1. `npm install` (and `npx playwright install chromium` for the browser checks).
2. `npm start` builds the page and opens the app.
3. Before the first release: on github.com create **`inquire-law-desktop`** under InquiringOwl as a **Public**, empty repository, then in Terminal:
   ```
   cd ~/Documents/inquire-law-desktop
   git init -b main
   git add -A && git commit -m "Inquire Law 0.1.0: Inquire UI shell, no content"
   git remote add origin https://github.com/InquiringOwl/inquire-law-desktop.git
   git push -u origin main
   ```
4. Release: `npm run release -- patch "Short note"`.
