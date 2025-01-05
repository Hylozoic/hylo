/* global beforeAll, afterEach, afterAll */

import mockGraphqlServer from '../../src/util/testing/mockGraphqlServer'
// Adds additional jest expecations for React Testing Library
//  https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// NOTE: This is what is ran in the jest config from setupTestFrameworkScriptFile / setupFilesAfterEnv (jest v24)
//       It is ran before every test file after the test environment is setup.
//       You Has access to installed test environment, methods like describe, expect and other globals.
//       You can for example add your custom matchers here.

// import { IntercomProvider } from 'react-use-intercom'

// ref: https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
// ref: https://github.com/jsdom/jsdom/issues/2524

beforeAll(() => mockGraphqlServer.listen({ onUnhandledRequest: 'error' }))
afterEach(() => mockGraphqlServer.resetHandlers())
afterAll(() => mockGraphqlServer.close())

const originalWarn = console.warn.bind(console.warn)
beforeAll(() => {
  console.warn = (msg) =>
    !msg.toString().includes('React Router Future Flag Warning') && originalWarn(msg)
})
afterAll(() => {
  console.warn = originalWarn
})
