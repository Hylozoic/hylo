#!/usr/bin/env bash
# Thin wrapper around Atmosphere in a Box (AiaB), pinned to a known commit.
# Usage: tools/atproto-sandbox/sandbox.sh <aiab sandbox args...>
#   e.g. tools/atproto-sandbox/sandbox.sh create --pds 1 --users-per-pds 1
set -euo pipefail

AIAB_REPO="https://tangled.org/kandake.africa/atmosphereinabox"
# Bump deliberately: AiaB pulls :latest images, so pin the CLI/templates at least.
AIAB_COMMIT="6cb9702a085600dfa982b1ec143fe7aa3406ed20"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AIAB_DIR="$HERE/.aiab"

if [ ! -d "$AIAB_DIR/.git" ]; then
  git clone --quiet "$AIAB_REPO" "$AIAB_DIR"
fi

current="$(git -C "$AIAB_DIR" rev-parse HEAD)"
if [ "$current" != "$AIAB_COMMIT" ]; then
  # Drop our local registration (below) so the checkout can move cleanly
  git -C "$AIAB_DIR" checkout --quiet -- stacks/components.json
  git -C "$AIAB_DIR" fetch --quiet origin
  git -C "$AIAB_DIR" checkout --quiet "$AIAB_COMMIT"
fi

# Install Hylo's managed application (hylo/) into the checkout and register it once.
# Activate with: sandbox.sh apply --app hylo
cp "$HERE/hylo/hylo.yaml" "$HERE/hylo/hylo.definition.json" "$AIAB_DIR/stacks/"
node -e '
  const fs = require("fs")
  const file = process.argv[1]
  const components = JSON.parse(fs.readFileSync(file, "utf8"))
  if (!components.some(c => c.id === "hylo")) {
    components.push({ id: "hylo", file: "stacks/hylo.yaml", application: "hylo", definition: "stacks/hylo.definition.json" })
    fs.writeFileSync(file, JSON.stringify(components, null, 2) + "\n")
  }
' "$AIAB_DIR/stacks/components.json"

cd "$AIAB_DIR"
exec deno task sandbox "$@"
