#!/usr/bin/env bash
# Build the staging PLC image from Bluesky's source at a pinned commit and, with --push, release
# it to a Heroku app.
# Usage: tools/atproto-plc-heroku/deploy.sh <heroku-app> [--push]
# Without --push it only builds, so the image can be checked with simulate.sh first.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PLC_REPO=https://github.com/did-method-plc/did-method-plc.git
PLC_COMMIT=ed532fadf23c524c0dfddc2e7c2b7da85b432ef5 # 2026-10-21 "Update server image to Node 24.22"

APP="${1:?usage: deploy.sh <heroku-app> [--push]}"
PUSH="${2:-}"
BASE="hylo-plc-upstream:${PLC_COMMIT:0:8}"
IMAGE="registry.heroku.com/$APP/web"

# Heroku dynos are linux/amd64, whatever this machine is
docker build --platform linux/amd64 -t "$BASE" -f packages/server/Dockerfile "$PLC_REPO#$PLC_COMMIT"
docker build --platform linux/amd64 --build-arg BASE="$BASE" -t "$IMAGE" "$HERE"
echo "Built $IMAGE (PLC $PLC_COMMIT)"

if [ "$PUSH" = "--push" ]; then
  heroku container:login
  docker push "$IMAGE"
  heroku container:release web --app "$APP"
  echo "Released to $APP. Check: curl https://<app domain>/_health"
else
  echo "Not pushed. Check it with: tools/atproto-plc-heroku/simulate.sh $IMAGE"
fi
