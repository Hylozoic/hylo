#!/bin/bash

# NOTE: THIS SCRIPT IS ONLY TO USED FOR LEGACY REPO TO MONOREPO DIRECTORY STRUCTURE
# CAN BE DELETED ONCE TRANSITION IS COMPLETE

# Check if the first parameter is provided
if [ -z "$1" ]; then
  echo "Error: A target directory name (e.g., 'apps/web') is required."
  exit 1
fi

TARGET_DIR="$1"

mkdir -p $TARGET_DIR

# move .env file to new location
mv .env $TARGET_DIR

# Move files to $TARGET_DIR/ directory
git ls-files -z | while IFS= read -r -d '' file; do
  # Only move files that are not already in $TARGET_DIR/
  if [[ "$file" != $TARGET_DIR/* ]]; then
    mkdir -p $TARGET_DIR/$(dirname "$file")
    git mv "$file" $TARGET_DIR/"$file"
  fi
done

# Find and remove empty directories, except for apps/*
find . -type d -empty ! -path "./apps/*" ! -path "./apps" -delete
