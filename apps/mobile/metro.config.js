const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require("nativewind/metro");

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
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
    ]
  },
  // Hoisted monorepo deps, and shared packages
  // Look into https://github.com/mmazzarolo/react-native-monorepo-tools for other another ways to handle this
  watchFolders: [
    path.resolve(__dirname, '../../node_modules'),
    path.resolve(__dirname, '../../packages/contexts'),
    path.resolve(__dirname, '../../packages/graphql'),
    path.resolve(__dirname, '../../packages/hooks'),
    path.resolve(__dirname, '../../packages/presenters'),
    path.resolve(__dirname, '../../packages/shared'),
    path.resolve(__dirname, '../../packages/urql')
  ]
};

module.exports = withNativeWind(mergeConfig(getDefaultConfig(__dirname), config), { input: path.resolve(__dirname, './src/style/global.css') });
