import i18next from 'i18next'
import Backend from 'i18next-http-backend'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

const initI18n = async () => {
  try {
    await i18next
      .use(Backend)
      .init({
        debug: true, // Enable debug logging
        backend: {
          loadPath: app.isPackaged ? 'http://hylo.com/locales/{{lng}}.json' : 'http://localhost:3000/locales/{{lng}}.json'
        },
        fallbackLng: 'en',
        supportedLngs: ['en', 'es'],
        nonExplicitSupportedLngs: true,
        interpolation: {
          escapeValue: false
        }
      })

    console.log('i18next initialized successfully')
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
