// Unit tests for plain TypeScript helpers (no native modules): run with
//   cd apps/mobile-leap && ../../node_modules/.bin/jest
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest'
  },
  globals: {
    __DEV__: false
  }
}
