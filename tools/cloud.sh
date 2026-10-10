#!/usr/bin/env bash
# Cloud-container setup for browser checks (smoke, layoutcheck, sheet, snap), which the device shell can't run.
#   bash tools/cloud.sh <staged law.tgz> [command…]
# Extracts into $CODEX (default /home/claude/codex) with tools/unpack.js semantics, installs Playwright (no browser
# download: Chromium is preinstalled), builds, then runs the optional command there, e.g.
#   bash tools/cloud.sh /mnt/user-data/uploads/codex-desktop/.sync/law.tgz node tools/layoutcheck.js a2-1
set -e
ARC="$1"; shift || true
CODEX="${CODEX:-/home/claude/codex}"
mkdir -p "$CODEX"
tar -xzf "$ARC" -C "$CODEX"
cd "$CODEX"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
[ -d node_modules/playwright ] || npm i --no-save --no-audit --no-fund playwright@1.56.0 >/dev/null 2>&1
mkdir -p .sync && touch .sync/.packed     # later `node tools/pack.js --changed` returns only what changed here
node tools/build-web.js >/dev/null
echo "ready: $CODEX"
[ $# -gt 0 ] && "$@" || true
