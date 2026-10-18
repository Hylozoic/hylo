#!/usr/bin/env bash
# Start/stop the bridge from the AiaB sandbox to the Hylo backend on the host.
# Usage: tools/atproto-sandbox/hylo/bridge.sh up|down|ps
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE=(docker compose -f "$HERE/bridge.compose.yaml")

case "${1:-}" in
  up) exec "${COMPOSE[@]}" up -d ;;
  down) exec "${COMPOSE[@]}" down ;;
  ps) exec "${COMPOSE[@]}" ps ;;
  *) echo "Usage: $0 up|down|ps" >&2; exit 1 ;;
esac
