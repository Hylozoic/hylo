import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  LOCALE_DE,
  LOCALE_EN_GB,
  LOCALE_EN_US,
  LOCALE_ES,
  LOCALE_FR,
  LOCALE_HI,
  LOCALE_PT,
  normalizeLocaleToFull
} from '@hylo/shared'
import { de, en, es, fr, hi, pt } from '../locales'

export const LOCALE_STORAGE_KEY = 'hylo-i18n-lng'

const resources = {
  en: { translation: en },
  [LOCALE_EN_US]: { translation: en },
  [LOCALE_EN_GB]: { translation: en },
  es: { translation: es },
  [LOCALE_ES]: { translation: es },
  de: { translation: de },
  [LOCALE_DE]: { translation: de },
  fr: { translation: fr },
  [LOCALE_FR]: { translation: fr },
  hi: { translation: hi },
  [LOCALE_HI]: { translation: hi },
  pt: { translation: pt },
  [LOCALE_PT]: { translation: pt }
}

i18n.use(initReactI18next).init({
  debug: false,
  resources,
  lng: LOCALE_EN_US,
  fallbackLng: {
    [LOCALE_EN_GB]: [LOCALE_EN_US, 'en'],
    [LOCALE_EN_US]: ['en'],
    [LOCALE_ES]: ['es'],
    [LOCALE_DE]: ['de'],
    [LOCALE_FR]: ['fr'],
    [LOCALE_HI]: ['hi'],
    [LOCALE_PT]: ['pt'],
    default: [LOCALE_EN_US]
  },
  compatibilityJSON: 'v4',
  supportedLngs: [
    LOCALE_EN_US,
    LOCALE_EN_GB,
    LOCALE_ES,
    LOCALE_DE,
    LOCALE_FR,
    LOCALE_HI,
    LOCALE_PT,
    'en',
    'es',
    'de',
    'fr',
    'hi',
    'pt'
  ],
  nonExplicitSupportedLngs: true,
  interpolation: { escapeValue: false }
})

/** Loads a previously chosen locale from device storage. */
export async function hydrateStoredLocale () {
  try {
    const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY)
    if (!stored) return
    await i18n.changeLanguage(normalizeLocaleToFull(stored))
  } catch {
    // Keep the default locale if storage is unavailable
  }
}

/** Persists the chosen locale so unauthenticated screens remember it. */
export function persistLocale (locale: string) {
  AsyncStorage.setItem(LOCALE_STORAGE_KEY, normalizeLocaleToFull(locale)).catch(() => {})
}

export default i18n
