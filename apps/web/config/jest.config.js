import paths from './paths.js'

export default {
  rootDir: paths.rootPath,
  transform: {
    '\\.(gql|graphql)$': 'jest-transform-graphql',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: ['/!node_modules\\/lodash/*'],
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{js,jsx}'
  ],
  coverageReporters: [
    'json',
    'lcov'
  ],
  resolver: 'jest-pnp-resolver',
  setupFiles: [
    'react-app-polyfill/jsdom',
    '<rootDir>/config/jest/beforeTestEnvSetup.js'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/config/jest/afterTestEnvSetup.js'
  ],
  testPathIgnorePatterns: [
    '<rootDir>[/\\\\](build|docs|node_modules|scripts|es5)[/\\\\]'
  ],
  moduleDirectories: [
    'node_modules',
    'src'
  ],
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true
  },
  snapshotSerializers: [
    'jest-serializer-graphql'
  ],
  testEnvironment: 'jest-environment-jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost'
  },
  roots: ['<rootDir>'],
  modulePaths: ['<rootDir>'],
  moduleNameMapper: {
    '^react-native$': 'react-native-web',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/config/jest/__mocks__/fileMock.js',
    '\\.(css|less|scss)$': '<rootDir>/config/jest/__mocks__/styleMock.js',
    '^client/(.*)$': '<rootDir>/src/client/$1',
    '^components/(.*)$': '<rootDir>/src/components/$1',
    '^contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^css/(.*)$': '<rootDir>/src/css/$1',
    '^hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@graphql/(.*)$': '<rootDir>/src/graphql/$1',
    '^router/(.*)$': '<rootDir>/src/router/$1',
    '^routes/(.*)$': '<rootDir>/src/routes/$1',
    '^store/(.*)$': '<rootDir>/src/store/$1',
    '^util/(.*)$': '<rootDir>/src/util/$1'
  },
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  // * Because console.log will get munched in test display with `verbose: true`:
  //   https://github.com/facebook/jest/issues/2441
  //   Note: Alternatively could use `--runInBand` to always run tests in serial
  verbose: false
}
