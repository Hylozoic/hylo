import { getRegionalLocale } from './locale'

// jsdom reports navigator.languages ['en-US', 'en']; each test sets the browser's own list
function setBrowserLocales (languages, language = languages[0]) {
  jest.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages)
  jest.spyOn(window.navigator, 'language', 'get').mockReturnValue(language)
}

describe('getRegionalLocale', () => {
  afterEach(() => jest.restoreAllMocks())

  it("uses the browser's region when the browser prefers the Hylo language", () => {
    setBrowserLocales(['en-AU', 'en'])
    expect(getRegionalLocale('en')).toBe('en-AU')
    expect(getRegionalLocale('en-US')).toBe('en-AU')
  })

  it('finds a matching browser locale further down the list, and canonicalizes its case', () => {
    setBrowserLocales(['en-AU', 'de-at'])
    expect(getRegionalLocale('de')).toBe('de-AT')
  })

  it('keeps the Hylo locale when the browser prefers another language', () => {
    setBrowserLocales(['en-AU'])
    expect(getRegionalLocale('de-DE')).toBe('de-DE')
    expect(getRegionalLocale('fr')).toBe('fr-FR')
  })

  it('keeps a region chosen in Hylo that is not the default for its language', () => {
    setBrowserLocales(['en-AU', 'pt-BR'])
    expect(getRegionalLocale('en-GB')).toBe('en-GB')
    expect(getRegionalLocale('pt-PT')).toBe('pt-PT')
  })

  it('ignores browser locales without a region', () => {
    setBrowserLocales(['en'])
    expect(getRegionalLocale('en')).toBe('en-US')
  })

  it('falls back to navigator.language when navigator.languages is empty', () => {
    setBrowserLocales([], 'en-NZ')
    expect(getRegionalLocale('en')).toBe('en-NZ')
  })

  it('falls back to the stored Hylo locale when none is given', () => {
    setBrowserLocales(['en-AU'])
    window.localStorage.setItem('hylo-i18n-lng', 'de-DE')
    expect(getRegionalLocale()).toBe('de-DE')
    window.localStorage.removeItem('hylo-i18n-lng')
  })
})
