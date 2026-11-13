import {
  FALLBACK_GOOGLE_FONTS,
  fetchGoogleFontFamilies,
  googleFontStylesheetUrl,
  loadGoogleFont
} from './googleFonts'

describe('fetchGoogleFontFamilies', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch })

  it('returns the built-in list without an API key', async () => {
    global.fetch = jest.fn()
    expect(await fetchGoogleFontFamilies('')).toEqual(FALLBACK_GOOGLE_FONTS)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('falls back to the built-in list when the API fails', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 403 }))
    expect(await fetchGoogleFontFamilies('key')).toEqual(FALLBACK_GOOGLE_FONTS)
  })

  it('returns the families from the Google Fonts API, dropping unusable names', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ items: [{ family: 'Roboto' }, { family: 'Bad; name' }, { family: 'Open Sans' }] })
    }))
    expect(await fetchGoogleFontFamilies('key')).toEqual(['Roboto', 'Open Sans'])
    expect(global.fetch.mock.calls[0][0]).toContain('https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity')
  })
})

describe('loadGoogleFont', () => {
  it('adds one stylesheet per family', () => {
    loadGoogleFont('Playfair Display')
    loadGoogleFont('Playfair Display')
    const links = document.querySelectorAll('link#google-font-Playfair-Display')
    expect(links).toHaveLength(1)
    expect(links[0].href).toEqual(googleFontStylesheetUrl('Playfair Display'))
    expect(links[0].href).toEqual('https://fonts.googleapis.com/css?family=Playfair+Display:300,400,500,700&display=swap')
  })

  it('ignores names that are not plain family names', () => {
    const before = document.querySelectorAll('link').length
    loadGoogleFont("x'); body { display: none")
    loadGoogleFont(null)
    expect(document.querySelectorAll('link')).toHaveLength(before)
  })
})
