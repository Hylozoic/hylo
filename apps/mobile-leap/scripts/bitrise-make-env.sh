#!/usr/bin/env bash
# Write apps/mobile-leap/.env from Bitrise (or CI) environment variables for Expo prebuild.
# Truncates the file each run — do not use >> like the legacy mobile step (that duplicates keys).
#
# Run from repo root: bash apps/mobile-leap/scripts/bitrise-make-env.sh

set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$APP_ROOT/.env"

write_var () {
  local key="$1"
  # shellcheck disable=SC2154
  printf '%s=%s\n' "$key" "${!key:-}"
}

{
  write_var API_HOST
  write_var HYLO_WEB_BASE_URL
  write_var SESSION_COOKIE_KEY
  write_var AUTH_DEBUG
  write_var ONESIGNAL_APP_ID
  write_var ONESIGNAL_APN_MODE
  write_var MIXPANEL_TOKEN
  write_var MAPBOX_TOKEN
  write_var SENTRY_DSN_URL
  write_var SENTRY_DEV_DSN_URL
  write_var SENTRY_URL
  write_var SENTRY_ORG
  write_var SENTRY_PROJECT
  write_var SENTRY_AUTH_TOKEN
  write_var IOS_GOOGLE_CLIENT_ID
  write_var WEB_GOOGLE_CLIENT_ID
  write_var INTERCOM_ANDROID_API_KEY
  write_var INTERCOM_IOS_API_KEY
  write_var INTERCOM_APP_ID
  write_var APPLE_TEAM_ID
  write_var EAS_PROJECT_ID
  write_var BUILD_NUMBER
} > "$ENV_FILE"

echo "Wrote $ENV_FILE"
echo "--- apps/mobile-leap/.env (secrets redacted in log) ---"
grep -E '^[A-Z_]+=' "$ENV_FILE" | sed 's/=.*$/=***/' || true

# Fastlane / Jira steps: set FASTLANE_*, JIRA_*, GRADLE_OPTS, etc. as Bitrise workflow env vars
# (legacy wrote them into repo-root .env; mobile-leap does not need Facebook keys)
