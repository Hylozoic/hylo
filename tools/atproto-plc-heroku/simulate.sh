#!/usr/bin/env bash
# Run a PLC image the way Heroku would, locally, and check it works before deploying:
# an SSL-only Postgres with a self-signed certificate, DATABASE_URL and PORT as the only config,
# a full DID lifecycle, then a database reset like a staging refresh.
# Usage: tools/atproto-plc-heroku/simulate.sh [image] [command...]
#   image defaults to the sandbox's PLC image; the command defaults to the image's own CMD.
#   For an image without this folder's Dockerfile on top, pass the command and PGSSLMODE yourself:
#   PLC_ENV="-e PGSSLMODE=no-verify" simulate.sh ghcr.io/ashex/atproto-containers/plc:latest \
#     sh -c 'cd /app/packages/server && node dist/bin.js'
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT="$HERE/../atproto-sandbox/client"
IMAGE="${1:-ghcr.io/ashex/atproto-containers/plc:latest}"
shift || true

NET=hylo-plc-sim
PG=hylo-plc-sim-pg
PLC=hylo-plc-sim-plc
PORT=45678 # anything but the image's default, as on Heroku
PASSWORD='p@ss/word+x' # Heroku passwords are random; this checks URL encoding is handled
WORK="$(mktemp -d)"

cleanup () {
  docker rm -f "$PLC" "$PG" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
docker rm -f "$PLC" "$PG" >/dev/null 2>&1 || true
trap cleanup EXIT

step () { printf '\n▶ %s\n' "$1"; }
curl_plc () { docker run --rm --network "$NET" curlimages/curl:8.11.1 -s -m 5 -w ' %{http_code}' "http://$PLC:$PORT$1"; }
psql_plc () { docker exec "$PG" psql -U herokuuser -d herokudb -tAq -c "$1"; }

[ -d "$CLIENT/node_modules" ] || (cd "$CLIENT" && npm install --no-audit --no-fund)
docker network create "$NET" >/dev/null 2>&1 || true

step "Postgres: SSL only, self-signed certificate"
openssl req -new -x509 -days 1 -nodes -subj "/CN=heroku-like-postgres" \
  -keyout "$WORK/server.key" -out "$WORK/server.crt" 2>/dev/null
printf 'local all all trust\nhostssl all all 0.0.0.0/0 scram-sha-256\nhostnossl all all 0.0.0.0/0 reject\n' > "$WORK/pg_hba.conf"
chmod 644 "$WORK"/*
docker run -d --name "$PG" --network "$NET" \
  -e POSTGRES_USER=herokuuser -e POSTGRES_PASSWORD="$PASSWORD" -e POSTGRES_DB=herokudb \
  -v "$WORK:/certs:ro" postgres:16.15-alpine3.24 \
  sh -c 'cp /certs/server.* /tmp/ && chown postgres /tmp/server.* && chmod 600 /tmp/server.key &&
    exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/tmp/server.crt \
      -c ssl_key_file=/tmp/server.key -c hba_file=/certs/pg_hba.conf' >/dev/null
for _ in $(seq 1 30); do docker exec "$PG" pg_isready -U herokuuser -d herokudb >/dev/null 2>&1 && break; sleep 1; done
echo "  ssl=$(psql_plc 'show ssl')"

step "PLC: $IMAGE, configured only by DATABASE_URL and PORT"
# shellcheck disable=SC2086
docker run -d --name "$PLC" --network "$NET" \
  -e DATABASE_URL="postgres://herokuuser:$(node -p 'encodeURIComponent(process.argv[1])' "$PASSWORD")@$PG:5432/herokudb" \
  -e PORT="$PORT" ${PLC_ENV:-} "$IMAGE" "$@" >/dev/null
wait_healthy () {
  for _ in $(seq 1 30); do
    [[ "$(curl_plc /_health 2>/dev/null)" == *" 200" ]] && return 0
    [ "$(docker inspect -f '{{.State.Running}}' "$PLC")" = true ] || break
    sleep 1
  done
  echo "  ✗ not healthy; logs:"; docker logs "$PLC" 2>&1 | tail -20; exit 1
}
wait_healthy
echo "  healthy: $(curl_plc /_health)"

step "DID lifecycle (create, resolve, rename, forged update rejected, tombstone)"
docker run --rm --network "$NET" \
  -e ATPROTO_PLC_URL="http://$PLC:$PORT" -e ATPROTO_HANDLE_DOMAIN=staging.hylo.test \
  -e ATPROTO_PDS_URL=https://pds.staging.hylo.test \
  -v "$CLIENT:/client:ro" -w /client node:24-alpine node spike.mjs | tail -3
DID="$(psql_plc 'select did from dids limit 1')"
echo "  $DID is stored ($(psql_plc 'select count(*) from operations') ops)"

step "Staging refresh: reset the database, restart the dyno"
psql_plc 'drop schema public cascade; create schema public;' 2>/dev/null
docker restart "$PLC" >/dev/null
wait_healthy
RESULT="$(curl_plc "/$DID")"
[[ "$RESULT" == *" 404" ]] || { echo "  ✗ expected 404 for $DID, got: $RESULT"; exit 1; }
echo "  re-migrated on boot; $DID is gone (404)"

printf '\n✅ Works the way it needs to on Heroku\n'
