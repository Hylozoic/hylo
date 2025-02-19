import { Image } from 'react-native'
import 'react-native-gesture-handler/jestSetup'
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock'
import mockClipboard from '@react-native-clipboard/clipboard/jest/clipboard-mock.js'

// Mocking the global.fetch included in React Native
global.fetch = jest.fn() // eslint-disable-line no-undef
global.XMLHttpRequest = jest.fn()

// Helper to mock a success response (only once)
fetch.mockResponseSuccess = body => {
  fetch.mockImplementationOnce(
    () => Promise.resolve({
      status: 200,
      json: () => Promise.resolve(body)
    })
  )
}
// Helper to mock a failure response (only once)
fetch.mockResponseFailure = error => {
  fetch.mockImplementationOnce(
    () => Promise.reject(error)
  )
}

global.FormData = jest.fn(() => {
  return []
})

// React Navigation - https://reactnavigation.org/docs/testing/
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock')
  // The mock for `call` immediately calls the callback which is incorrect
  // So we override it with a no-op
  Reanimated.default.call = () => {}
  return Reanimated
})

// https://github.com/mixpanel/mixpanel-react-native/issues/88
jest.mock('mixpanel-react-native', () => ({
  __esModule: true,
  default: () => jest.fn(),
  Mixpanel: jest.fn(() => ({
    init: jest.fn()
  }))
}))

jest.mock('react-native-screens', () => ({
  ...jest.requireActual('react-native-screens'),
  enableScreens: jest.fn()
}))

jest.mock('@intercom/intercom-react-native', () => {}, { virtual: true })

jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn()
}))

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: () => {}
  }
}))

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext)

jest.mock('react-native-background-timer', () => {})

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn()
}))

// import mockRNCNetInfo from '@react-native-community/netinfo/jest/netinfo-mock.js'
// jest.mock('@react-native-community/netinfo', () => mockRNCNetInfo)

jest.mock('react-native-bootsplash', () => {
  return {
    hide: jest.fn().mockResolvedValueOnce(),
    show: jest.fn().mockResolvedValueOnce(),
    getVisibilityStatus: jest.fn().mockResolvedValue('hidden')
  }
})

jest.mock('react-native-onesignal', () => ({
  OneSignal: jest.fn(() => 'undefined'),
  setNotificationOpenedHandler: jest.fn(() => 'undefined'),
  init: jest.fn(() => 'undefined'),
  inFocusDisplaying: jest.fn(() => 'undefined'),
  addEventListener: jest.fn(() => 'undefined')
}))

jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter.js', () =>
  require('react-native/Libraries/EventEmitter/__mocks__/NativeEventEmitter.js')
)

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  withTranslation: () => Component => {
    Component.defaultProps = { ...Component.defaultProps, t: (str) => str }
    return Component
  },
  useTranslation: (domain) => {
    return {
      t: (str) => str,
      i18n: {
        changeLanguage: () => new Promise(() => {})
      }
    }
  }
}))

jest.mock('react-native-webview', () => {
  const { View } = require('react-native')
  return {
    WebView: () => View
  }
})

// https://github.com/react-native-clipboard/clipboard
jest.mock('@react-native-clipboard/clipboard', () => mockClipboard)
