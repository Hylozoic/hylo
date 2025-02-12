module.exports = function(api) {
  api.cache(false)

  return {
    presets: [
      'module:@react-native/babel-preset',
      'nativewind/babel'
    ],
    plugins: [
      [
        'module-resolver',
        {
          extensions: [
            '.js',
            '.jsx',
            '.ts',
            '.tsx',
            '.android.js',
            '.android.tsx',
            '.ios.js',
            '.ios.tsx',
            '.graphql'
          ],
          root: ['./src'],
          alias: {
            config: './config',
            assets: './assets'
          }
        }
      ],
      'import-graphql',
      'react-native-reanimated/plugin',
      ['@babel/plugin-proposal-decorators', { version: '2023-11' }],
      // Suppressed warnings
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],
      ['@babel/plugin-transform-class-properties', { loose: true }]

    ],
    env: {
      test: {
        presets: [
          ['@babel/preset-env', { modules: 'commonjs' }] // Force CommonJS in tests
        ],
        plugins: [
          'remove-style',
          // Does seem to be needed
          ['module-resolver', {
            root: ['./src'],
            alias: {
              '@hylo': '../../packages',
              config: './config',
              assets: './assets'
            }
          }]
        ]
      },
      production: {
        plugins: [
          'transform-remove-console'
        ]
      }
    }
  }
}
