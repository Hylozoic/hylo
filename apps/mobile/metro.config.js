const path = require('path')
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const { withNativeWind } = require('nativewind/metro')
const { withSentryConfig } = require('@sentry/react-native/metro')

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true
      }
    })
  },
  resolver: {
    // Needs this if we want to try
    // and load a static HTML file with local JS, CSS, and TTF references.
    // * May need to makes-sure to carry-over defaults
    // assetExts: ['html', 'css', 'jpg', 'png', 'ttf', 'graphql'],
    assetExts: ['png', 'jpg', 'graphql'],
    sourceExts: ['js', 'json', 'ts', 'tsx', 'cjs', 'svg'],
    nodeModulesPaths: [
      path.resolve(__dirname, '../../node_modules'),
      path.resolve(__dirname, 'node_modules')
    ],
    resolveRequest: (context, moduleName, platform) => {
      // Handle @hylo/presenters subpath imports
      if (moduleName.startsWith('@hylo/presenters/')) {
        const subpath = moduleName.replace('@hylo/presenters/', '')
        const filePath = path.resolve(__dirname, `../../packages/presenters/dist/cjs/${subpath}.js`)

        // Check if the file exists
        const fs = require('fs')
        if (fs.existsSync(filePath)) {
          return {
            filePath,
            type: 'sourceFile'
          }
        }
      }
      // Let Metro handle other modules
      return context.resolveRequest(context, moduleName, platform)
    }
  },
  // Hoisted monorepo deps, and shared packages
  // Look into https://github.com/mmazzarolo/react-native-monorepo-tools for other another ways to handle this
  watchFolders: [
    path.resolve(__dirname, '../../node_modules'),
    path.resolve(__dirname, '../../packages/contexts'),
    path.resolve(__dirname, '../../packages/graphql'),
    path.resolve(__dirname, '../../packages/hooks'),
    path.resolve(__dirname, '../../packages/presenters'),
    path.resolve(__dirname, '../../packages/navigation'),
    path.resolve(__dirname, '../../packages/shared'),
    path.resolve(__dirname, '../../packages/urql')
  ]
}

// Merge default config with custom config
const mergedConfig = mergeConfig(getDefaultConfig(__dirname), config)

// Apply NativeWind config
const withNativeWindConfig = withNativeWind(mergedConfig, {
  input: path.resolve(__dirname, './src/style/global.css')
})

// Sentry config should always be applied last
// https://docs.sentry.io/platforms/react-native/manual-setup/metro
module.exports = withSentryConfig(withNativeWindConfig)
