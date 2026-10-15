#!/usr/bin/env bash
# Run spike.mjs in a Node 24 container on the AiaB private network.
# The network is internal (no internet), so deps are installed on the host and mounted.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="${AIAB_PROJECT:-atproto-sandbox}"

[ -d "$HERE/node_modules" ] || (cd "$HERE" && npm install --no-audit --no-fund)

exec docker run --rm \
  --network "${PROJECT}_atmosinabox" \
  --dns "${AIAB_DNS:-172.30.249.3}" \
  -v "${PROJECT}_public-ca:/ca:ro" \
  -e NODE_EXTRA_CA_CERTS=/ca/root.crt \
  -v "$HERE:/spike:ro" -w /spike \
  node:24-alpine node spike.mjs
