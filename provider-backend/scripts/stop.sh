#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT/.pids/provider.pid"
if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" || true
    echo "stopped pid=$PID"
  else
    echo "stale pid file"
  fi
  rm -f "$PID_FILE"
else
  echo "no pid file"
fi
