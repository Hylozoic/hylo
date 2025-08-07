const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
const path = require('path');
 
const config = getDefaultConfig(__dirname)

// Add alias for config directory
config.resolver.alias = {
  ...config.resolver.alias,
  'config': path.resolve(__dirname, 'config')
}

// Configure monorepo support
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, '../../node_modules'),
  path.resolve(__dirname, 'node_modules')
]

// Monorepo packages now handled via package.json exports fields

// Hoisted monorepo deps, and shared packages
config.watchFolders = [
  path.resolve(__dirname, '../../node_modules'),
  path.resolve(__dirname, '../../packages/contexts'),
  path.resolve(__dirname, '../../packages/graphql'),
  path.resolve(__dirname, '../../packages/hooks'),
  path.resolve(__dirname, '../../packages/presenters'),
  path.resolve(__dirname, '../../packages/navigation'),
  path.resolve(__dirname, '../../packages/shared'),
  path.resolve(__dirname, '../../packages/urql')
]

// Enable package exports for React Native 0.79+ (modern npm package support)
// Our monorepo packages now have proper exports fields defined
config.resolver.unstable_enablePackageExports = true
 
module.exports = withNativeWind(config, { input: './src/style/global.css' }) 