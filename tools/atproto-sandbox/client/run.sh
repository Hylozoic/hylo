#!/usr/bin/env bash
# Run a Node script from this folder in a container on the AiaB private network.
# The network is internal (no internet), so deps are installed on the host and mounted.
# Usage: tools/atproto-sandbox/client/run.sh [script.mjs] [args...]   (default: spike.mjs)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="${AIAB_PROJECT:-atproto-sandbox}"
SCRIPT="${1:-spike.mjs}"
shift || true

[ -d "$HERE/node_modules" ] || (cd "$HERE" && npm install --no-audit --no-fund)

exec docker run --rm \
  --network "${PROJECT}_atmosinabox" \
  --dns "${AIAB_DNS:-172.30.249.3}" \
  -v "${PROJECT}_public-ca:/ca:ro" \
  -e NODE_EXTRA_CA_CERTS=/ca/root.crt \
  -v "$HERE:/client:ro" -w /client \
  node:24-alpine node "$SCRIPT" "$@"
