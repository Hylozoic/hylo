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
  watchFolders: [
    path.resolve(__dirname, '../../node_modules'),
    path.resolve(__dirname, '../../packages/shared'),
    path.resolve(__dirname, '../../packages/contexts')
  ]
};

module.exports = withNativeWind(mergeConfig(getDefaultConfig(__dirname), config), { input: path.resolve(__dirname, './src/style/global.css') });
