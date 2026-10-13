module.exports = {
  root: true,
  extends: [
    'prettier',
    '@react-native',
    'standard',
    'standard-jsx',
    'standard-react'
  ],
  parser: '@babel/eslint-parser',
  parserOptions: {
    requireConfigFile: false,
    project: './tsconfig.json'
  },
  plugins: [
    'react',
    'react-native'
  ],
  rules: {
    'prettier/prettier': 'off',
    'react/prop-types': 'off',
    'react/no-children-prop': 'warn',
    'react/jsx-handler-names': 'off',
    'react/jsx-fragments': 'warn',
    'react/jsx-wrap-multilines': 'warn',
    'import/export': 'off'
  },
  settings: {
    react: {
      version: 'detect'
    },
    jest: {
      version: require('jest/package.json').version
    }
  },
  env: {
    'react-native/react-native': true,
    'jest/globals': true
  },
  overrides: [
    {
      files: [
        '**/*.test.js',
        '**/*.spec.js'
      ],
      extends: [
        'plugin:jest/recommended',
        'plugin:testing-library/react'
      ],
      plugins: [
        'jest',
        'testing-library'
      ],
      rules: {
        'jest/no-disabled-tests': 'warn',
        'jest/no-focused-tests': 'error',
        'jest/no-identical-title': 'error',
        'jest/prefer-to-have-length': 'warn',
        'jest/valid-expect': 'error',
        'testing-library/prefer-screen-queries': 'off',
        'testing-library/prefer-user-event': 'off',
        'testing-library/await-async-queries': 'error',
        'testing-library/no-await-sync-queries': 'error',
        'testing-library/no-debugging-utils': 'warn',
        'testing-library/no-dom-import': 'off',
        'testing-library/consistent-data-testid': [
          2,
          {
            testIdAttribute: ['testID'],
            testIdPattern: '^TestId(__[A-Z]*)?$'
          }
        ]
      }
    }
  ]
}
