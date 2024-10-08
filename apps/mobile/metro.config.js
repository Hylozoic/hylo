const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

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
    // Add paths where Metro can look for peer dependencies
    extraNodeModules: {
      'moment-timezone': path.resolve(__dirname, 'node_modules/moment-timezone')
    }
  },
  // Hoisted monorepo deps, and shared packages
  watchFolders: [
    path.resolve(__dirname, '../../node_modules'),
    path.resolve(__dirname, '../../packages/shared')
  ]
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
