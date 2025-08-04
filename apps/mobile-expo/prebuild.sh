#!/bin/bash

# Ignore any arguments passed by EAS
set -- "$@"

# Go to the root of the monorepo
cd ../..

echo "Building shared packages..."
echo "Checking if yarn is available..."
which yarn || echo "yarn not found in PATH"
echo "Checking if package.json exists..."
ls -la package.json || echo "package.json not found"
echo "Checking available scripts..."
yarn run --help || echo "yarn run failed"
echo "Running build-packages..."
yarn workspaces foreach --recursive --from='packages/*' --topological --verbose run build 