#!/bin/bash

# NOTE: This utility script is instead of using "npx uri-scheme open", which would also be fine
# this version just gives us more flexibility, is easier to type, and doesn't require installing
# uri-scheme globally or having to wait it to download each time

SCHEME="https://www.hylo.com/"
PLATFORM="ios"

# Function to show usage
usage() {
  echo "Usage: yarn open-link <url-or-path> [--android]"
  echo "Example: yarn open-link https://example.com/profile/123"
  echo "         yarn open-link /profile/123"
  echo "         yarn open-link myapp://profile/123 --android"
  exit 1
}

# Check if input is provided
if [ -z "$1" ]; then
  usage
fi

# Read input and shift args
INPUT_URL="$1"
shift # Remove first argument from list

# Check for platform override
for arg in "$@"; do
  if [ "$arg" == "--android" ]; then
    PLATFORM="android"
  fi
done

# If the input already starts with 'myapp://', use it as is
if [[ "$INPUT_URL" == myapp://* ]]; then
  DEEP_LINK="$INPUT_URL"
else
  # Remove 'https://' or 'http://' and domain, keeping only the path/query
  EXTRACTED_PATH=$(echo "$INPUT_URL" | sed -E 's#https?://[^/]+##')

  # Ensure no leading slash causes double slashes in the final URL
  EXTRACTED_PATH=$(echo "$EXTRACTED_PATH" | sed -E 's#^/##')

  # Construct the deep link
  DEEP_LINK="$SCHEME$EXTRACTED_PATH"
fi

echo "Opening deep link: $DEEP_LINK on $PLATFORM..."

if [ "$PLATFORM" == "ios" ]; then
  xcrun simctl openurl booted "$DEEP_LINK"
else
  adb shell am start -W -a android.intent.action.VIEW -d "$DEEP_LINK" com.hylo.hyloandroid
fi
