#!/usr/bin/env bash
# After expo prebuild, align release signing with legacy apps/mobile (HYLO_* in ~/.gradle/gradle.properties).
# Without this, release APKs are debug-signed → Play Protect + cannot update Play Store installs.

set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GRADLE_FILE="$APP_ROOT/android/app/build.gradle"

if [ ! -f "$GRADLE_FILE" ]; then
  echo "No android/app/build.gradle — skip signing patch"
  exit 0
fi

if grep -q 'HYLO_RELEASE_KEY_ALIAS' "$GRADLE_FILE"; then
  echo "Android Hylo release signing already patched"
  exit 0
fi

python3 << PY
from pathlib import Path

path = Path("$GRADLE_FILE")
content = path.read_text()

debug_block = """        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }"""

release_config = """        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (project.hasProperty('HYLO_RELEASE_STORE_FILE')) {
                storeFile file(HYLO_RELEASE_STORE_FILE)
                storePassword HYLO_RELEASE_STORE_PASSWORD
                keyAlias HYLO_RELEASE_KEY_ALIAS
                keyPassword HYLO_RELEASE_KEY_PASSWORD
            }
        }
    }"""

if debug_block not in content:
    raise SystemExit('patch-android-hylo-signing: unexpected build.gradle signingConfigs layout')

content = content.replace(debug_block, release_config, 1)

old_release = """        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug"""

new_release = """        release {
            signingConfig signingConfigs.release"""

if old_release not in content:
    raise SystemExit('patch-android-hylo-signing: unexpected release buildType block')

content = content.replace(old_release, new_release, 1)
path.write_text(content)
print('Patched release signing in android/app/build.gradle')
PY
