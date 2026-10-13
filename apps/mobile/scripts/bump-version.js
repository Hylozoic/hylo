#!/usr/bin/env node

/**
 * 🚀 This script overrides the default `yarn version` command.
 *
 * Instead of using Yarn Berry's `yarn version`, this script:
 * - Uses `npm version <type> --no-workspaces-update` to properly handle workspaces.
 * - Ensures compatibility with Yarn's `workspace:*` dependencies.
 * - Automatically triggers `react-native-version` via the `postversion` script.
 *
 * Usage:
 *   yarn bump-version patch      # Bumps patch version
 *   yarn bump-version minor      # Bumps minor version
 *   yarn bump-version major      # Bumps major version
 *   yarn bump-version premajor   # Bumps to next major version with prerelease
 */

const { execSync } = require('child_process')

// Get all arguments passed to the script (e.g., `major`, `minor`, `patch`, `premajor`)
const args = process.argv.slice(2).join(' ')

try {
  console.log(`🚀 Running: npm version ${args} --no-workspaces-update`)
  execSync(`npm version ${args} --no-workspaces-update`, { stdio: 'inherit' })
} catch (error) {
  console.error('❌ Error running npm version:', error.message)
  process.exit(1)
}
