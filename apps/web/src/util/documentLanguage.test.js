import i18next from 'i18next'
import { syncDocumentLanguage } from './documentLanguage'

beforeEach(() => {
  document.documentElement.lang = 'en'
})

it('sets <html lang> when i18n initializes and whenever the language changes', async () => {
  const i18n = i18next.createInstance()
  syncDocumentLanguage(i18n)

  await i18n.init({ lng: 'es-ES', resources: {} })
  expect(document.documentElement.lang).toBe('es-ES')

  await i18n.changeLanguage('hi-IN')
  expect(document.documentElement.lang).toBe('hi-IN')
})

it('applies a language that is already active', async () => {
  const i18n = i18next.createInstance()
  await i18n.init({ lng: 'fr-FR', resources: {} })

  syncDocumentLanguage(i18n)

  expect(document.documentElement.lang).toBe('fr-FR')
})
