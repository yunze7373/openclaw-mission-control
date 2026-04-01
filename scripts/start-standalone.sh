#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3000}"

cd "$ROOT"

if [ ! -f ".next/standalone/server.js" ]; then
  echo "standalone build missing: run npm run build first" >&2
  exit 1
fi

mkdir -p .next/standalone/.next

if [ -d ".next/static" ]; then
  rm -rf .next/standalone/.next/static
  cp -R .next/static .next/standalone/.next/static
fi

mkdir -p .next/standalone/scripts
cp scripts/openclaw-rpc.cjs .next/standalone/scripts/openclaw-rpc.cjs

if [ -d "public" ]; then
  rm -rf .next/standalone/public
  cp -R public .next/standalone/public
fi

export PORT
export MISSION_CONTROL_ORIGIN="${MISSION_CONTROL_ORIGIN:-http://127.0.0.1:${PORT}}"
export MISSION_CONTROL_INSTANCE_ID="${MISSION_CONTROL_INSTANCE_ID:-mission-control-dashboard}"

cd .next/standalone
exec node server.js
