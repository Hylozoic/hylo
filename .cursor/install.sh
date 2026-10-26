#!/usr/bin/env bash
# Cloud Agent environment install for the Hylo monorepo.
# Idempotent: safe to re-run. Performs durable, source-derived setup so the
# resulting state can be captured in an environment snapshot/build:
#   - Node 24 (via nvm) + Yarn 4.9.2 (via corepack)
#   - PostgreSQL + PostGIS and Redis (system packages)
#   - JS dependencies + shared package builds
#   - Backend/web .env files with safe local-dev placeholders
#   - hylo / hylo_test databases loaded from migrations/schema.sql
#   - Dummy seed data (test@hylo.com / hylo)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

NODE_VERSION="24"
PG_VERSION="16"

log() { echo "[install] $*"; }

# ---------------------------------------------------------------------------
# 1. Node 24 + Yarn 4.9.2
# ---------------------------------------------------------------------------
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  log "Installing nvm"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"

log "Installing Node $NODE_VERSION"
nvm install "$NODE_VERSION" >/dev/null
nvm alias default "$NODE_VERSION" >/dev/null
nvm use "$NODE_VERSION" >/dev/null

NODE_BIN_DIR="$(dirname "$(nvm which "$NODE_VERSION")")"
# Ensure login shells (used by the `terminals`) prefer Node 24 over any
# pre-existing node on PATH.
PATH_LINE="export PATH=\"$NODE_BIN_DIR:\$PATH\""
for rc in "$HOME/.bashrc" "$HOME/.profile"; do
  touch "$rc"
  grep -qF "$NODE_BIN_DIR" "$rc" || echo "$PATH_LINE" >> "$rc"
done
export PATH="$NODE_BIN_DIR:$PATH"

log "Enabling Yarn 4.9.2 via corepack"
corepack enable
corepack prepare yarn@4.9.2 --activate

log "node=$(node --version) yarn=$(yarn --version)"

# ---------------------------------------------------------------------------
# 2. System services: PostgreSQL + PostGIS and Redis
# ---------------------------------------------------------------------------
if ! command -v psql >/dev/null 2>&1 || ! command -v redis-server >/dev/null 2>&1; then
  log "Installing PostgreSQL + PostGIS and Redis"
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    postgresql "postgresql-contrib" postgis "postgresql-${PG_VERSION}-postgis-3" \
    redis-server build-essential python3 pkg-config
fi

log "Starting Redis"
sudo service redis-server start || true

log "Starting PostgreSQL"
sudo pg_ctlcluster "$PG_VERSION" main start 2>/dev/null || sudo service postgresql start || true
# Wait for Postgres to accept connections
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q 2>/dev/null; then break; fi
  sleep 1
done

# Create a login role matching the current user with DB privileges, and enable
# trust auth for local TCP connections (local development only).
DB_USER="$(whoami)"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE ROLE \"$DB_USER\" WITH LOGIN SUPERUSER CREATEDB CREATEROLE;"

HBA_FILE="$(sudo -u postgres psql -tA -c 'SHOW hba_file;')"
sudo sed -i -E "s#^host\s+all\s+all\s+127\.0\.0\.1/32\s+\S+#host all all 127.0.0.1/32 trust#" "$HBA_FILE"
sudo sed -i -E "s#^host\s+all\s+all\s+::1/128\s+\S+#host all all ::1/128 trust#" "$HBA_FILE"
sudo pg_ctlcluster "$PG_VERSION" main reload 2>/dev/null || sudo service postgresql reload || true

# ---------------------------------------------------------------------------
# 3. JS dependencies + shared packages
# ---------------------------------------------------------------------------
log "Installing JS dependencies (yarn install)"
yarn install

log "Building shared packages"
yarn build-packages

# ---------------------------------------------------------------------------
# 4. Environment files (safe local-dev placeholders)
# ---------------------------------------------------------------------------
BACKEND_ENV="apps/backend/.env"
WEB_ENV="apps/web/.env"

if [ ! -f "$BACKEND_ENV" ]; then
  log "Creating $BACKEND_ENV"
  cp apps/backend/.env.example "$BACKEND_ENV"
  # Fake Stripe keys so the server boots (Stripe features stay disabled).
  sed -i 's|^STRIPE_SECRET_KEY=.*|STRIPE_SECRET_KEY=sk_test_fake_key_for_local_development|' "$BACKEND_ENV"
  sed -i 's|^STRIPE_PUBLISHABLE_KEY=.*|STRIPE_PUBLISHABLE_KEY=pk_test_fake_key_for_local_development|' "$BACKEND_ENV"
  # The oidc-provider requires a PKCS#1 ("BEGIN RSA PRIVATE KEY") key; modern
  # OpenSSL emits PKCS#8 by default, so generate the traditional format.
  OIDC_KEY="$(openssl genrsa -traditional 2048 2>/dev/null | base64 -w0)"
  node -e 'const fs=require("fs");const f=process.argv[1];let s=fs.readFileSync(f,"utf8");s=s.replace(/^OIDC_KEYS=.*$/m,"OIDC_KEYS="+process.argv[2]);fs.writeFileSync(f,s)' "$BACKEND_ENV" "$OIDC_KEY"
fi

if [ ! -f "$WEB_ENV" ]; then
  log "Creating $WEB_ENV"
  cp apps/web/.env.example "$WEB_ENV"
fi

# ---------------------------------------------------------------------------
# 5. Databases: schema + dummy seed
# ---------------------------------------------------------------------------
create_db_with_schema() {
  local db="$1"
  if ! psql -h localhost -U "$DB_USER" -lqt | cut -d'|' -f1 | grep -qw "$db"; then
    log "Creating database $db and loading schema"
    createdb -h localhost -U "$DB_USER" "$db"
    psql -h localhost -U "$DB_USER" -d "$db" -q -f apps/backend/migrations/schema.sql
  fi
}

create_db_with_schema hylo
create_db_with_schema hylo_test

# Seed dummy data only if the DB looks empty. The faker-based seed can hit
# random unique-name collisions, so retry a few times (as the README notes).
USER_COUNT="$(psql -h localhost -U "$DB_USER" -d hylo -tA -c 'SELECT count(*) FROM users' 2>/dev/null || echo 0)"
if [ "${USER_COUNT:-0}" -lt 2 ]; then
  log "Seeding dummy data"
  pushd apps/backend >/dev/null
  seeded=0
  for _ in $(seq 1 8); do
    if echo "yes" | NODE_ENV=dummy yarn knex seed:run 2>&1 | grep -q "Error during seeding"; then
      log "Seed hit a random collision; retrying"
      continue
    fi
    seeded=1
    break
  done
  popd >/dev/null
  [ "$seeded" = "1" ] && log "Seed complete" || log "WARNING: seed did not complete cleanly"
fi

log "Install complete."
