module.exports = {
  presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
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
          'config': './config',
          'assets': './assets'
        }
      }
    ],
    'import-graphql',
    'react-native-reanimated/plugin',
    ['@babel/plugin-syntax-decorators', { 'version': '2023-11' }]
  ],
  env: {
    test: {
      plugins: [
        'remove-style'
      ]
    },
    production: {
      plugins: [
        'transform-remove-console'
      ]
    }
  }
}
