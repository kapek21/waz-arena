#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p .pids
if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and fill PROVIDER_KEY / SHARED_SECRET"
  exit 1
fi
# shellcheck disable=SC1091
set -a; source .env; set +a
if [[ ! -d node_modules ]]; then
  npm install
fi
nohup npx tsx src/index.ts > ".pids/provider.log" 2>&1 &
echo $! > .pids/provider.pid
echo "provider started pid=$(cat .pids/provider.pid) port=${PORT:-43080}"
