/* global jest */

// NOTE: This is linked in jest config under "setupFiles"
// This is ran before every test file before the test environment is setup.

import React from 'react'

// Swallow lingering GraphQL fetches so they don't crash Jest after suites finish
process.on('unhandledRejection', (reason) => {
  const message = reason?.message || String(reason)
  if (
    message.includes('/noo/graphql') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ECONNREFUSED') ||
    message.includes('network error')
  ) return
  // Keep other unexpected rejections visible in the console
  console.error('Unhandled rejection in tests:', reason)
})

global.IS_REACT_ACT_ENVIRONMENT = true

global.graphql = jest.fn()

const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn()
}

global.navigator.geolocation = mockGeolocation

// Global Mocks
jest.mock('react-use-intercom', () => ({
  IntercomProvider: ({ children }) => children,
  useIntercom: () => ({ show: () => {} })
}))

jest.mock('client/errorReporter', () => ({
  __esModule: true,
  SENTRY_DEBUG: false,
  addBreadcrumb: jest.fn(),
  default: {
    disabled: true,
    error: error => console.log(error),
    configure: jest.fn()
  }
}))

const mockT = (str, params) => {
  if (!params) return str
  let result = str
  Object.entries(params).forEach(([key, value]) => {
    result = result.replace(`{{${key}}}`, value)
  })
  return result
}

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  withTranslation: () => Component => {
    const ComponentWithTranslation = (props) => <Component {...props} t={mockT} />
    return ComponentWithTranslation
  },
  useTranslation: () => {
    return {
      t: mockT,
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

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockReturnValue({ }),
  useLocation: jest.fn().mockReturnValue({ pathname: '', search: '' })
}))
jest.mock('react-tsparticles', () => () => 'ParticlesComponent')
jest.mock('react-map-gl', () => ({
  __esModule: true,
  default: () => 'MapGlComponent',
  NavigationControl: () => 'NavigationControlComponent',
  useControl: jest.fn(() => 'useControl')
}))
jest.mock('@deck.gl/react', () => {
  const React = require('react')
  return React.forwardRef((props, ref) => (
    <div ref={ref}>Mocked DeckGL Component</div>
  ))
})
jest.mock('@deck.gl-community/editable-layers', () => ({
  EditableGeoJsonLayer: jest.fn(() => ({
    onEdit: jest.fn(),
    data: [],
    mode: 'view',
    selectedFeatureIndexes: [],
    getCursor: jest.fn(() => 'default')
  })),
  ViewMode: 'ViewMode',
  DrawPolygonMode: 'DrawPolygonMode'
}))

jest.mock('mixpanel-browser', () => ({
  track: jest.fn(),
  identify: jest.fn(),
  get_group: jest.fn().mockImplementation(() => ({
    set: jest.fn()
  })),
  set_group: jest.fn(),
  people: {
    set: jest.fn()
  }
}))

jest.mock('react-cool-inview', () => ({
  useInView: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  }))
}))

jest.mock('util/webView', () => ({
  __esModule: true,
  default: jest.fn(() => false),
  isWebView: jest.fn(() => false),
  isLegacyWebView: jest.fn(() => false),
  getMobileAppVersion: jest.fn(() => ''),
  sendMessageToWebView: jest.fn()
}))

// Skip cookie-consent UI/async work in unit tests
jest.mock('util/cookieConsent', () => ({
  shouldSkipCookieConsent: jest.fn(() => true),
  getCookieConsent: jest.fn(() => null),
  setCookieConsent: jest.fn(() => true),
  validateCookieConsent: jest.fn(() => false),
  syncCookieConsentWithBackend: jest.fn(() => Promise.resolve()),
  updateCookieFromDatabase: jest.fn(() => false),
  createCookieConsentData: jest.fn(() => ({})),
  linkCookieConsentToUser: jest.fn(() => Promise.resolve())
}))

// Wrap isomorphic-fetch so aborted/unhandled requests don't reject across test
// boundaries (MSW still intercepts the underlying HTTP via requireActual).
jest.mock('isomorphic-fetch', () => {
  const actualFetch = jest.requireActual('isomorphic-fetch')
  const wrapped = (...args) =>
    Promise.resolve(actualFetch(...args)).catch(() => ({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
      text: async () => JSON.stringify({ data: {} })
    }))
  return Object.assign(wrapped, actualFetch)
})

// Preserve real Intl (needed by Luxon) while forcing a stable timezone for tests
const RealDateTimeFormat = Intl.DateTimeFormat
window.Intl.DateTimeFormat = function (...args) {
  const formatter = new RealDateTimeFormat(...args)
  const originalResolvedOptions = formatter.resolvedOptions.bind(formatter)
  formatter.resolvedOptions = () => ({
    ...originalResolvedOptions(),
    timeZone: 'Etc/GMT'
  })
  return formatter
}
Object.setPrototypeOf(window.Intl.DateTimeFormat, RealDateTimeFormat)
window.Intl.DateTimeFormat.supportedLocalesOf = RealDateTimeFormat.supportedLocalesOf.bind(RealDateTimeFormat)

window.matchMedia = jest.fn().mockImplementation(query => {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }
})

window.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}))

window.alert = jest.fn()
window.confirm = jest.fn().mockReturnValue(true)

window.CSS = {
  Transform: {
    toString: jest.fn()
  }
}
