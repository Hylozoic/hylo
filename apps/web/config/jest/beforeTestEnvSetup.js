/* global jest */

// NOTE: This is linked in jest config under "setupFiles"
// This is ran before every test file before the test environment is setup.

import React from 'react'

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

jest.mock('client/rollbar', () => ({
  error: error => console.log(error),
  configure: jest.fn()
}))

// replaced with AI, just keeping for reference
// const mockT = (str, params) => {
//   if (!params) return str
//   let result = str
//   Object.entries(params).forEach(([key, value]) => {
//     result = result.replace(`{{${key}}}`, value)
//   })
//   return result
// }

// jest.mock('react-i18next', () => ({
//   ...jest.requireActual('react-i18next'),
//   withTranslation: () => Component => {
//     const ComponentWithTranslation = (props) => <Component {...props} t={mockT} />
//     return ComponentWithTranslation
//   },
//   useTranslation: () => {
//     return {
//       t: mockT,
//       i18n: {
//         changeLanguage: () => new Promise(() => {})
//       }
//     }
//   },
//   initReactI18next: {
//     type: '3rdParty',
//     init: () => {}
//   }
// }))

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  withTranslation: () => Component => {
    Component.defaultProps = {
      ...Component.defaultProps,
      t: (str, params) => {
        if (params) {
          return str.replace(/{{([^}]+)}}/g, (_, key) => {
            const keys = key.split('.')
            let value = params
            for (const k of keys) {
              value = value[k.trim()]
            }
            return value
          })
        }
        return str
      }
    }
    return Component
  },
  useTranslation: () => {
    return {
      t: (str, params) => {
        if (params) {
          return str.replace(/{{([^}]+)}}/g, (_, key) => {
            const keys = key.split('.')
            let value = params
            for (const k of keys) {
              value = value[k.trim()]
            }
            return value
          })
        }
        return str
      },
      i18n: {
        changeLanguage: () => new Promise(() => {})
      }
    }
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

// This broke with luxon, is there a different way to set default timezone?
// window.Intl = {
//   DateTimeFormat: jest.fn().mockImplementation(() => ({
//     resolvedOptions: jest.fn().mockImplementation(() => ({
//       timeZone: 'Etc/GMT'
//     }))
//   }))
// }

window.matchMedia = jest.fn().mockImplementation(query => {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn()
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
