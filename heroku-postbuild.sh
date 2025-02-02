#!/bin/bash

# Check if YARN2_WORKSPACE_PATH is set
if [ -z "$YARN2_WORKSPACE_PATH" ]; then
  echo "Error: YARN2_WORKSPACE_PATH is not set."
  exit 1
fi

# Execute commands based on the value of YARN2_WORKSPACE_PATH
case "$YARN2_WORKSPACE_PATH" in
  "apps/web")
    echo "Building the web workspace..."
    yarn workspace web build
    ;;
  "apps/backend")
    echo "Building the shared package..."
    yarn workspace @hylo/shared build

    if [ "$YARN2_SKIP_PRUNING" = "true" ]; then
      echo "Installing dependencies for backend workspace only..."
      yarn workspaces focus backend --production
    else
      echo "Warning: YARN2_SKIP_PRUNING is not set to true. All workspace dependencies are installed..."
    fi
    ;;
  *)
    echo "Error: Unrecognized YARN2_WORKSPACE_PATH value: $YARN2_WORKSPACE_PATH"
    exit 1
    ;;
esac
