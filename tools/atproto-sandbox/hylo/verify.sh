#!/usr/bin/env bash
# Verify every active Hylo identity from inside the sandbox (official resolver + reference PDS).
# Needs: sandbox up, `bridge.sh up`, and the Hylo backend running on the host.
# Usage: tools/atproto-sandbox/hylo/verify.sh [handle...]   (default: all active handles in the dev DB)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ENV="$HERE/../../../apps/backend/.env"

if [ "$#" -gt 0 ]; then
  handles=("$@")
else
  database_url="$(grep -E '^DATABASE_URL=' "$BACKEND_ENV" | cut -d= -f2-)"
  read -r -a handles <<< "$(psql "$database_url" -Atc \
    "select string_agg(handle, ' ' order by id) from atproto_identities where status = 'active'")"
fi

exec "$HERE/../client/run.sh" verify-hylo.mjs "${handles[@]}"
