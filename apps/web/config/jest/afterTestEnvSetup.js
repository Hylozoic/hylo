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
import * as util from 'util'
Object.defineProperty(window, 'TextEncoder', {
  writable: true,
  value: util.TextEncoder
})
Object.defineProperty(window, 'TextDecoder', {
  writable: true,
  value: util.TextDecoder
})

// Keep the mockGraphqlServer (msw) tidy between tests
beforeAll(() => mockGraphqlServer.listen({ onUnhandledRequest: 'error' }))
afterEach(() => mockGraphqlServer.resetHandlers())
afterAll(() => mockGraphqlServer.close())

// Global Mocks
jest.mock('react-use-intercom', () => ({
  IntercomProvider: ({ children }) => children,
  useIntercom: () => ({ show: () => {} })
}))

jest.mock('client/rollbar', () => ({
  error: error => console.log(error),
  configure: jest.fn()
}))

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  withTranslation: () => Component => {
    Component.defaultProps = { ...Component.defaultProps, t: (str) => str }
    return Component
  },
  useTranslation: () => {
    return {
      t: (str) => str,
      i18n: {
        changeLanguage: () => new Promise(() => {})
      }
    }
  },
  initReactI18next: {
    type: '3rdParty',
    init: () => {}
  }
}))

jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useParams: jest.fn()
}))
