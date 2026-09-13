#!/usr/bin/env bash
# Per-boot startup for the Hylo monorepo Cloud Agent environment.
# Databases and dependencies are prepared in install.sh (and captured in the
# environment snapshot); here we only (re)start the ephemeral service
# processes that do not survive into a new pod. The dev servers themselves run
# as `terminals` so their logs are visible and restartable.
set -euo pipefail

PG_VERSION="16"

echo "[start] Starting Redis"
sudo service redis-server start || true

echo "[start] Starting PostgreSQL"
sudo pg_ctlcluster "$PG_VERSION" main start 2>/dev/null || sudo service postgresql start || true

for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q 2>/dev/null; then
    echo "[start] PostgreSQL is ready"
    break
  fi
  sleep 1
done
