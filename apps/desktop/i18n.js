import i18next from 'i18next'
import Backend from 'i18next-http-backend'
import { app } from 'electron'
import {
  LOCALE_EN_GB,
  LOCALE_EN_US,
  LOCALE_ES,
  localeToTranslationKey
} from '@hylo/shared'

const initI18n = async () => {
  try {
    await i18next
      .use(Backend)
      .init({
        debug: true, // Enable debug logging
        backend: {
          loadPath: (lngs) => {
            const lng = localeToTranslationKey(lngs[0])
            return app.isPackaged ? `http://hylo.com/locales/${lng}.json` : `http://localhost:3000/locales/${lng}.json`
          }
        },
        fallbackLng: {
          [LOCALE_EN_GB]: [LOCALE_EN_US],
          default: [LOCALE_EN_US]
        },
        supportedLngs: [LOCALE_EN_US, LOCALE_EN_GB, LOCALE_ES, 'en', 'es'],
        nonExplicitSupportedLngs: true,
        interpolation: {
          escapeValue: false
        }
      })
    return i18next
  } catch (error) {
    console.error('Failed to initialize i18next:', error)
    // Provide a fallback translation function that just returns the key
    return {
      t: (key, options) => {
        console.warn('Fallback translation used for key:', key)
        return key
      }
    }
  }
}

export { initI18n, i18next }
