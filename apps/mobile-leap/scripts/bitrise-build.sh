#!/usr/bin/env bash
# CI build prep for mobile-leap (Bitrise or any CI).
#
# Usage: scripts/bitrise-build.sh <ios|android>
#
# Bitrise mapping (duplicate _setup-mobile-leap + platform workflow):
#   _setup: Script(6) corepack → Yarn install → bitrise-make-env.sh → configure.sh
#   platform: this script (set SKIP_YARN_INSTALL=1 if _setup already ran yarn install)
#
# Does everything up to (but not including) the native compile:
#   1. yarn install (monorepo)
#   2. build @hylo/* workspace packages (Metro resolves @hylo/presenters from dist/cjs)
#   3. expo prebuild — generates the ios/ or android/ folder (they are gitignored)
#   4. iOS only: pod install
#
# After this script, CI runs the platform archive step:
#   iOS:     Xcode archive — workspace apps/mobile-leap/ios/Hylo.xcworkspace, scheme Hylo
#   Android: Gradle — apps/mobile-leap/android, task :app:bundleRelease (or assembleRelease)
#
# Config comes from environment variables (app.config.ts reads process.env directly;
# Expo CLI also auto-loads apps/mobile-leap/.env if present). Set in Bitrise secrets:
#   API_HOST, HYLO_WEB_BASE_URL             (staging or production URLs)
#   ONESIGNAL_APP_ID, ONESIGNAL_APN_MODE    (optional — push)
#   SENTRY_DSN_URL, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN (optional — crash + source maps)
#   INTERCOM_APP_ID, INTERCOM_IOS_API_KEY, INTERCOM_ANDROID_API_KEY (optional)
#   MIXPANEL_TOKEN, MAPBOX_TOKEN            (optional)
#   IOS_GOOGLE_CLIENT_ID, WEB_GOOGLE_CLIENT_ID, APPLE_TEAM_ID
#
# Secret files (from the code-signing repo, if enabling push/Google services):
#   google-services.json → apps/mobile-leap/  (same file as legacy — package is com.hylo.hyloandroid)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

apply_ci_signing_assets () {
  local platform="$1"
  local app_root="$2"
  local staging="$app_root/.ci-signing"

  if [ ! -d "$staging" ]; then
    echo "No .ci-signing (skipping native secret file copy — run configure.sh in _setup)"
    return 0
  fi

  if [ "$platform" = "android" ] && [ -d "$app_root/android/app" ]; then
    echo "--- Copy Android keystores into android/app/"
    cp "$staging/android/"*.keystore "$app_root/android/app/"
  fi

  if [ "$platform" = "ios" ] && [ -f "$staging/ios/GoogleService-Info.plist" ]; then
    local info_plist
    info_plist=$(find "$app_root/ios" -name Info.plist -not -path '*/Pods/*' | head -1)
    if [ -n "$info_plist" ]; then
      echo "--- Copy GoogleService-Info.plist next to app Info.plist"
      cp "$staging/ios/GoogleService-Info.plist" "$(dirname "$info_plist")/"
    fi
  fi
}

PLATFORM="${1:-}"
if [ "$PLATFORM" != "ios" ] && [ "$PLATFORM" != "android" ]; then
  echo "Usage: $0 <ios|android>" >&2
  exit 1
fi

# Run from monorepo root (script lives in apps/mobile-leap/scripts/)
cd "$(dirname "$0")/../../.."
echo "Monorepo root: $PWD"
echo "Node: $(node -v)"

# Yarn 4 via corepack (repo pins yarn@4.9.2 in package.json packageManager)
corepack enable || true
echo "Yarn: $(yarn -v)"

if [ "${SKIP_YARN_INSTALL:-}" != "1" ]; then
  echo "--- yarn install"
  yarn install --immutable
else
  echo "--- skipping yarn install (SKIP_YARN_INSTALL=1)"
fi

echo "--- Building @hylo/* workspace packages"
yarn workspaces foreach --recursive --from='packages/*' --topological run build

cd apps/mobile-leap

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export APPLE_TEAM_ID="${APPLE_TEAM_ID:-L4KZBPS2F3}"
# Release CI must not prebuild with expo-dev-client (USE_EXPO_DEV_CLIENT is local-only).
unset USE_EXPO_DEV_CLIENT

echo "--- expo prebuild ($PLATFORM)"
# --clean: always regenerate from app.config.ts (folders are gitignored, never stale in CI)
# --no-install: node_modules is already installed; pods handled explicitly below
npx expo prebuild --platform "$PLATFORM" --clean --no-install

apply_ci_signing_assets "$PLATFORM" "$(pwd)"

if [ "$PLATFORM" = "android" ]; then
  bash "$SCRIPT_DIR/patch-android-hylo-signing.sh"
fi

if [ "$PLATFORM" = "ios" ]; then
  bash "$SCRIPT_DIR/patch-ios-hylo-signing.sh"
  echo "--- pod install"
  npx pod-install ios
fi

echo "--- Done. Native project ready in apps/mobile-leap/$PLATFORM/"
