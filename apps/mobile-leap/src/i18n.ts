import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en, es } from '../locales'

i18n.use(initReactI18next).init({
  debug: false,
  resources: {
    en: { translation: en },
    es: { translation: es }
  },
  fallbackLng: 'en',
  compatibilityJSON: 'v4',
  supportedLngs: ['en', 'es'],
  nonExplicitSupportedLngs: true,
  interpolation: { escapeValue: false }
})

export default i18n
