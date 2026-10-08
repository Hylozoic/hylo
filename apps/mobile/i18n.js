import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
  LOCALE_EN_GB,
  LOCALE_EN_US,
  LOCALE_ES
} from '@hylo/shared'
import { en, es } from './locales'

const resources = {
  en: {
    translation: en
  },
  [LOCALE_EN_US]: {
    translation: en
  },
  [LOCALE_EN_GB]: {
    translation: en
  },
  es: {
    translation: es
  },
  [LOCALE_ES]: {
    translation: es
  }
}

i18n
  .use(initReactI18next)
  .init({
    debug: false,
    resources,
    compatibilityJSON: 'v3',
    fallbackLng: {
      [LOCALE_EN_GB]: [LOCALE_EN_US, 'en'],
      [LOCALE_EN_US]: ['en'],
      [LOCALE_ES]: ['es'],
      default: [LOCALE_EN_US]
    },
    // i18next doesn't seem to be handling the interpolation of plurals correctly with react native
    // https://github.com/i18next/i18next/issues/1671
    // https://github.com/i18next/react-i18next/issues/1495
    // Reliant on the v3 fallback here, which uses a different plural-key syntax
    supportedLngs: [LOCALE_EN_US, LOCALE_EN_GB, LOCALE_ES, 'en', 'es'],
    pathMatcher: './locales/{locale}.json',
    nonExplicitSupportedLngs: true,
    nsSeparator: false,
    defaultNS: false,
    interpolation: {
      escapeValue: false // not needed for react as it escapes by default
    }
  })

export default i18n
