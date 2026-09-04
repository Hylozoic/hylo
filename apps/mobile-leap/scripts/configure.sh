#!/usr/bin/env bash
# Bitrise / CI: fetch signing assets from code-signing repo (same sources as apps/mobile).
# Native ios/ and android/ do not exist yet — keystores and plist are staged under .ci-signing/
# until expo prebuild runs (see bitrise-build.sh → applyCiSigningAssets).
#
# Run from repo root: bash apps/mobile-leap/scripts/configure.sh

set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGING="$APP_ROOT/.ci-signing"

echo "mobile-leap configure — app root: $APP_ROOT"

mytmpdir=$(mktemp -d 2>/dev/null || mktemp -d -t 'hylo-codesign')
trap 'rm -rf "$mytmpdir"' EXIT

git clone -b android --depth 1 https://github.com/Hylozoic/code-signing.git "$mytmpdir"/android
git clone -b ios --depth 1 https://github.com/Hylozoic/code-signing.git "$mytmpdir"/ios

mkdir -p "$STAGING/android" "$STAGING/ios"

echo "Applying google-services.json (prebuild reads ./google-services.json)"
cp "$mytmpdir"/android/google-services.json "$APP_ROOT/google-services.json"

echo "Staging Android keystores"
cp "$mytmpdir"/android/debug.keystore "$STAGING/android/"
cp "$mytmpdir"/android/hylo-release-original.keystore "$STAGING/android/"
cp "$mytmpdir"/android/hylo-release-key-2017-08.keystore "$STAGING/android/"

echo "Staging iOS GoogleService-Info.plist"
cp "$mytmpdir"/ios/GoogleService-Info.plist "$STAGING/ios/"

read -r -d '' gradleProperties <<EOF || true
HYLO_DEBUG_STORE_FILE=debug.keystore
HYLO_DEBUG_KEY_ALIAS=androiddebugkey
HYLO_DEBUG_STORE_PASSWORD=android
HYLO_DEBUG_KEY_PASSWORD=android
HYLO_RELEASE_STORE_FILE=hylo-release-original.keystore
HYLO_RELEASE_KEY_ALIAS=MyAndroidKey
HYLO_RELEASE_STORE_PASSWORD=${HYLO_RELEASE_STORE_PASSWORD:-}
HYLO_RELEASE_KEY_PASSWORD=${HYLO_RELEASE_KEY_PASSWORD:-}
EOF

if [ -z "${HYLO_RELEASE_STORE_PASSWORD:-}" ] || [ -z "${HYLO_RELEASE_KEY_PASSWORD:-}" ]; then
  echo "WARNING: HYLO_RELEASE_STORE_PASSWORD / HYLO_RELEASE_KEY_PASSWORD not set — release Gradle signing may fail"
fi

if [ -z "${CI+x}" ]; then
  echo "Local: add to ~/.gradle/gradle.properties if you need release signing:"
  echo "$gradleProperties"
else
  echo "Writing ~/.gradle/gradle.properties for CI"
  mkdir -p "$HOME/.gradle"
  echo "$gradleProperties" > "$HOME/.gradle/gradle.properties"
fi

echo "Configure done."
