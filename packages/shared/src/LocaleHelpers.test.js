import {
  LOCALE_DE,
  LOCALE_EN_GB,
  LOCALE_EN_US,
  LOCALE_ES,
  LOCALE_FR,
  LOCALE_HI,
  LOCALE_PT,
  localeToTranslationKey,
  normalizeLocaleToFull
} from './LocaleHelpers'

describe('normalizeLocaleToFull', () => {
  it('accepts legacy short codes', () => {
    expect(normalizeLocaleToFull('en')).toBe(LOCALE_EN_US)
    expect(normalizeLocaleToFull('es')).toBe(LOCALE_ES)
    expect(normalizeLocaleToFull('de')).toBe(LOCALE_DE)
    expect(normalizeLocaleToFull('fr')).toBe(LOCALE_FR)
    expect(normalizeLocaleToFull('hi')).toBe(LOCALE_HI)
    expect(normalizeLocaleToFull('pt')).toBe(LOCALE_PT)
  })

  it('returns canonical full codes', () => {
    expect(normalizeLocaleToFull('en-US')).toBe(LOCALE_EN_US)
    expect(normalizeLocaleToFull('en-GB')).toBe(LOCALE_EN_GB)
    expect(normalizeLocaleToFull('es-ES')).toBe(LOCALE_ES)
  })

  it('defaults unknown values to en-US', () => {
    expect(normalizeLocaleToFull()).toBe(LOCALE_EN_US)
    expect(normalizeLocaleToFull('')).toBe(LOCALE_EN_US)
    expect(normalizeLocaleToFull('xx')).toBe(LOCALE_EN_US)
  })
})

describe('localeToTranslationKey', () => {
  it('maps english variants to en', () => {
    expect(localeToTranslationKey('en')).toBe('en')
    expect(localeToTranslationKey('en-US')).toBe('en')
    expect(localeToTranslationKey('en-GB')).toBe('en')
  })

  it('maps other locales to translation file keys', () => {
    expect(localeToTranslationKey('es-ES')).toBe('es')
    expect(localeToTranslationKey('de')).toBe('de')
  })
})
