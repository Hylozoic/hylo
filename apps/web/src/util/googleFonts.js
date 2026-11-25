import { isGroupThemeFontFamily } from '@hylo/shared'

/**
 * Google Fonts for group themes: the list of families to choose from, and
 * loading a chosen family's stylesheet.
 */

// Shown when no API key is configured, or the Google Fonts API cannot be reached
export const FALLBACK_GOOGLE_FONTS = [
  'Bitter', 'Crimson Text', 'DM Sans', 'DM Serif Display', 'EB Garamond', 'Fraunces', 'IBM Plex Sans',
  'Inter', 'Josefin Sans', 'Karla', 'Lato', 'Libre Baskerville', 'Lora', 'Manrope', 'Merriweather',
  'Montserrat', 'Nunito', 'Open Sans', 'Oswald', 'Playfair Display', 'Poppins', 'PT Serif', 'Quicksand',
  'Raleway', 'Roboto', 'Roboto Slab', 'Rubik', 'Source Sans 3', 'Source Serif 4', 'Space Grotesk', 'Work Sans'
]

const WEBFONTS_API = 'https://www.googleapis.com/webfonts/v1/webfonts'
// The weights the app uses; Google serves whichever of them a family has
const WEIGHTS = '300,400,500,700'

let familiesPromise = null

/**
 * The font families stewards can choose from, most popular first: the full
 * Google Fonts catalogue when VITE_GOOGLE_FONTS_API_KEY is set, otherwise a
 * short built-in list. Never rejects.
 */
export function fetchGoogleFontFamilies (apiKey = import.meta.env.VITE_GOOGLE_FONTS_API_KEY) {
  if (!apiKey) return Promise.resolve(FALLBACK_GOOGLE_FONTS)
  if (!familiesPromise) {
    familiesPromise = fetch(`${WEBFONTS_API}?sort=popularity&fields=items(family)&key=${encodeURIComponent(apiKey)}`)
      .then(response => {
        if (!response.ok) throw new Error(`Google Fonts API returned ${response.status}`)
        return response.json()
      })
      .then(data => {
        const families = (data.items || []).map(item => item.family).filter(isGroupThemeFontFamily)
        return families.length > 0 ? families : FALLBACK_GOOGLE_FONTS
      })
      .catch(() => {
        familiesPromise = null
        return FALLBACK_GOOGLE_FONTS
      })
  }
  return familiesPromise
}

export function googleFontStylesheetUrl (family) {
  return `https://fonts.googleapis.com/css?family=${encodeURIComponent(family).replace(/%20/g, '+')}:${WEIGHTS}&display=swap`
}

/**
 * Adds the stylesheet for a Google Fonts family to the page, once. Does
 * nothing for names that are not plain family names.
 */
export function loadGoogleFont (family) {
  if (typeof document === 'undefined' || !isGroupThemeFontFamily(family)) return
  const id = `google-font-${family.replace(/ /g, '-')}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = googleFontStylesheetUrl(family)
  document.head.appendChild(link)
}
