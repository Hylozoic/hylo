// This is a much clearer way to setup transformIgnorePatterns but does come with a danger of over-matching.
// See disclaimer at https://jestjs.io/docs/configuration#transformignorepatterns-arraystring
const esModules = [
  'jest-',
  'react-native',
  '@react-native',
  '@react-native-community',
  '@react-navigation',
  'react-native-render-html',
  '@invertase/react-native-apple-authentication',
  '@react-native-picker',
  'react-native-css-interop',
  // Our own packages are ESM modules only so need to be
  // transformed as jest is CommonJS only
  '@hylo'
]

module.exports = {
  preset: 'react-native',
  setupFiles: [
    '<rootDir>/config/jest/setupEnv.js',
    'react-native-gesture-handler/jestSetup'
  ],
  // resolver: '<rootDir>/jest.resolver.js',
  moduleDirectories: [
    '<rootDir>/node_modules',
    '<rootDir>/../../node_modules'
  ],
  setupFilesAfterEnv: [
    // https://callstack.github.io/react-native-testing-library/docs/migration/jest-matchers
    '@testing-library/jest-native/legacy-extend-expect',
    '<rootDir>/config/jest/setupTests.js',
    '<rootDir>/src/graphql/mocks/mswServer.js'
  ],
  testEnvironment: 'jest-fixed-jsdom',
  transformIgnorePatterns: [
    `node_modules/(?!<rootDir>${esModules.join('|')})`
  ],
  moduleNameMapper: {
    '\\.(png|jpg|jpeg|gif|webp|svg)$': 'jest-transform-stub',
    // 2025-02-12 -- Doesn't seem needed at this time, remove it it continues to not be
    // '^@hylo/(.*)$': '<rootDir>/../../packages/$1', // Ensure Jest resolves @hylo correctly
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
