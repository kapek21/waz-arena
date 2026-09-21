#!/usr/bin/env bash
# Usage: ./scripts/copy-to-game.sh /path/to/game [port] [slug]
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST_ROOT="${1:?game root required}"
PORT="${2:-43080}"
SLUG="${3:-game}"
DEST="$DEST_ROOT/provider-backend"
mkdir -p "$DEST"
rsync -a --delete \
  --exclude node_modules --exclude .env --exclude .pids --exclude dist \
  "$SRC/" "$DEST/"
# patch .env.example GAME_SLUG / PORT
if [[ -f "$DEST/.env.example" ]]; then
  if grep -q '^PORT=' "$DEST/.env.example"; then
    sed -i.bak "s/^PORT=.*/PORT=$PORT/" "$DEST/.env.example" && rm -f "$DEST/.env.example.bak"
  fi
  if grep -q '^GAME_SLUG=' "$DEST/.env.example"; then
    sed -i.bak "s/^GAME_SLUG=.*/GAME_SLUG=$SLUG/" "$DEST/.env.example" && rm -f "$DEST/.env.example.bak"
  else
    echo "GAME_SLUG=$SLUG" >> "$DEST/.env.example"
  fi
fi
echo "Copied provider-backend → $DEST (PORT=$PORT SLUG=$SLUG)"
