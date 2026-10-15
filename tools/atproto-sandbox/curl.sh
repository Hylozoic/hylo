#!/usr/bin/env bash
# curl from inside the AiaB network (sandbox DNS + trusted sandbox CA).
# Usage: tools/atproto-sandbox/curl.sh https://plc.atmosbox.test/<did> [curl args...]
set -euo pipefail
PROJECT="${AIAB_PROJECT:-atproto-sandbox}"

exec docker run --rm \
  --network "${PROJECT}_atmosinabox" \
  --dns "${AIAB_DNS:-172.30.249.3}" \
  -v "${PROJECT}_public-ca:/ca:ro" \
  curlimages/curl:8.11.1 -sS --cacert /ca/root.crt "$@"
