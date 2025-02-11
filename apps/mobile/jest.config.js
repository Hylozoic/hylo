const esModules = [
  'jest-',
  'react-native',
  '@react-native',
  '@react-native-community',
  '@react-navigation',
  'react-native-render-html',
  '@invertase/react-native-apple-authentication',
  '@flyerhq/react-native-keyboard-accessory-view',
  '@react-native-picker',
  'react-native-css-interop',
  '@hylo/contexts',
  '@hylo/graphql',
  '@hylo/hooks',
  '@hylo/presenters',
  '@hylo/shared',
  '@hylo/urql'
]

module.exports = {
  preset: 'react-native',
  setupFiles: [
    '<rootDir>/config/jest/setupEnv.js',
    'react-native-gesture-handler/jestSetup'
  ],
  setupFilesAfterEnv: [
    // https://callstack.github.io/react-native-testing-library/docs/migration/jest-matchers
    '@testing-library/jest-native/legacy-extend-expect',
    '<rootDir>/config/jest/setupTests.js',
    '<rootDir>/src/graphql/mocks/mswServer.js'
  ],
  testEnvironment: 'jest-fixed-jsdom',
  // testEnvironmentOptions: {
  //   customExportConditions: ['node'] // Ensure we load correct exports for Node tests
  // },
  // transformIgnorePatterns: [
  //   'node_modules/(?!(jest-)?@react-native|react-native|@react-native-community|@react-navigation|react-native-render-html|@invertase/react-native-apple-authentication|@flyerhq/react-native-keyboard-accessory-view|@react-native-picker|@hylo|query-string|packages|query-string|decode-uri-component|split-on-first|filter-obj)'
  // ],
  transformIgnorePatterns: [
    `node_modules/(?!${esModules.join('|')})`
  ],
  transform: {
    '^.+\\.m?[jt]sx?$': 'babel-jest' // ⬅️ Forces Jest to transform ESM into CommonJS
  },
  // extensionsToTreatAsEsm: ['.ts', '.tsx', '.mjs', '.js'],
  moduleNameMapper: {
    // Explicit mapping for @hylo/* packages
    '^@hylo/(.*)$': '<rootDir>/../../packages/$1',
    '\\.(png|jpg|jpeg|gif|webp|svg)$': 'jest-transform-stub'
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/*.spec.{js,jsx,ts,tsx}'
  ],
  coverageReporters: ['json', 'lcov'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  snapshotSerializers: ['jest-serializer-graphql'],
  watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname']
}
