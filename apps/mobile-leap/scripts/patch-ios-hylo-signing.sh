#!/usr/bin/env bash
# After expo prebuild, enable automatic signing on the main Hylo app target.
# Expo sets DEVELOPMENT_TEAM when APPLE_TEAM_ID is present but often omits CODE_SIGN_STYLE
# on the primary target (OneSignal NSE gets it). Bitrise xcode-archive treats that as
# manual signing and falls back to uploaded IOS_DISTRIBUTION .p12 certs.

set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PBXPROJ="$APP_ROOT/ios/Hylo.xcodeproj/project.pbxproj"
TEAM_ID="${APPLE_TEAM_ID:-L4KZBPS2F3}"

if [ ! -f "$PBXPROJ" ]; then
  echo "No ios/Hylo.xcodeproj/project.pbxproj — skip iOS signing patch"
  exit 0
fi

python3 << PY
from pathlib import Path
import os
import re

pbx = Path("$PBXPROJ")
team_id = os.environ.get("APPLE_TEAM_ID") or "L4KZBPS2F3"
content = pbx.read_text()

# Expo can write literal "undefined" when appleTeamId is missing at prebuild time.
content = content.replace("DevelopmentTeam = undefined;", f"DevelopmentTeam = {team_id};")

def patch_hylo_app_configs (text):
    # Main app target uses Hylo/Hylo.entitlements (not the OneSignal extension).
    pattern = re.compile(
        r'(^\t\t\t\tCODE_SIGN_ENTITLEMENTS = Hylo/Hylo\.entitlements;\n)(?!\t\t\t\tCODE_SIGN_STYLE)',
        re.MULTILINE
    )
    updated, count = pattern.subn(
        r'\1\t\t\t\tCODE_SIGN_STYLE = Automatic;\n',
        text
    )
    if count == 0 and 'CODE_SIGN_ENTITLEMENTS = Hylo/Hylo.entitlements' in text:
        if 'CODE_SIGN_STYLE = Automatic' in text:
            return text
        raise SystemExit('patch-ios-hylo-signing: Hylo app build configuration not found')
    if count == 0:
        raise SystemExit('patch-ios-hylo-signing: Hylo app build configuration not found')
    return updated

content = patch_hylo_app_configs(content)

if "DEVELOPMENT_TEAM = undefined" in content:
    content = content.replace("DEVELOPMENT_TEAM = undefined", f"DEVELOPMENT_TEAM = {team_id}")

pbx.write_text(content)
print(f"Patched iOS automatic signing (team {team_id}) in project.pbxproj")

PY
