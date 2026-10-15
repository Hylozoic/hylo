#!/usr/bin/env bash
# Run a host command (e.g. `yarn atproto ...`) so Node can reach the AiaB sandbox.
# Requires the loopback relay: tools/atproto-sandbox/sandbox.sh access start
# Usage: tools/atproto-sandbox/with-sandbox.sh yarn atproto status alice@hylo.com
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export NODE_OPTIONS="${NODE_OPTIONS:-} --require $HERE/host-env.cjs"
exec "$@"
