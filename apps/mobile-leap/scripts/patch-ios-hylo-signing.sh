#!/usr/bin/env bash
# After expo prebuild, set automatic signing + development team on Hylo app targets.
# Expo may omit CODE_SIGN_STYLE on the main target and can skip DEVELOPMENT_TEAM when
# APPLE_TEAM_ID is only in .env (not exported to the shell). Bitrise archive then fails
# with "Signing for Hylo requires a development team".

set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PBXPROJ="$APP_ROOT/ios/Hylo.xcodeproj/project.pbxproj"

if [ -f "$APP_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$APP_ROOT/.env"
  set +a
fi

export APPLE_TEAM_ID="${APPLE_TEAM_ID:-L4KZBPS2F3}"

if [ ! -f "$PBXPROJ" ]; then
  echo "No ios/Hylo.xcodeproj/project.pbxproj — skip iOS signing patch"
  exit 0
fi

python3 << PY
from pathlib import Path
import os
import re

pbx = Path("$PBXPROJ")
team_id = os.environ["APPLE_TEAM_ID"]
content = pbx.read_text()

content = content.replace("DevelopmentTeam = undefined;", f"DevelopmentTeam = {team_id};")
content = content.replace("DEVELOPMENT_TEAM = undefined;", f"DEVELOPMENT_TEAM = {team_id};")

def patch_hylo_app_configs (text):
    marker = "CODE_SIGN_ENTITLEMENTS = Hylo/Hylo.entitlements;"
    parts = text.split(marker)
    if len(parts) < 2:
        raise SystemExit("patch-ios-hylo-signing: Hylo app build configuration not found")

    patched = [parts[0]]
    for block in parts[1:]:
        segment = marker + block
        closing = segment.find("\n\t\t\t};")
        if closing == -1:
            raise SystemExit("patch-ios-hylo-signing: malformed Hylo build configuration")

        settings = segment[:closing]
        rest = segment[closing:]

        if "DEVELOPMENT_TEAM" not in settings:
            settings += f"\n\t\t\t\tDEVELOPMENT_TEAM = {team_id};"
        else:
            settings = re.sub(
                r"DEVELOPMENT_TEAM = [^;]+;",
                f"DEVELOPMENT_TEAM = {team_id};",
                settings
            )

        if "CODE_SIGN_STYLE" not in settings:
            settings += "\n\t\t\t\tCODE_SIGN_STYLE = Automatic;"

        patched.append(settings + rest)

    return "".join(patched)

content = patch_hylo_app_configs(content)

pbx.write_text(content)
print(f"Patched iOS automatic signing (team {team_id}) in project.pbxproj")
PY

APP_DELEGATE="$APP_ROOT/ios/Hylo/AppDelegate.swift"
if [ -f "$APP_DELEGATE" ] && grep -q '^#import' "$APP_DELEGATE"; then
  sed -i '' '/^#import/d' "$APP_DELEGATE"
  echo "Removed invalid #import lines from AppDelegate.swift (Intercom pre-8.4 expo plugin)"
fi
