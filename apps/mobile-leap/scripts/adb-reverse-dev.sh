#!/usr/bin/env bash
# Forward localhost ports to the connected Android emulator/device for local dev.
if ! command -v adb >/dev/null 2>&1; then
  echo 'adb not found — skipping port reverse (install Android platform-tools)'
  exit 0
fi

if ! adb get-state >/dev/null 2>&1; then
  echo 'No Android device/emulator connected — skipping adb reverse'
  exit 0
fi

adb reverse tcp:3000 tcp:3000
adb reverse tcp:3001 tcp:3001
adb reverse tcp:8081 tcp:8081
echo 'adb reverse: localhost:3000, :3001 and :8081 (Metro) forwarded to device'
