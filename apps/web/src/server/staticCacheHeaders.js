import path from 'path'

/** Vite default: /assets/index-<hash>.js|css|… */
const VITE_HASHED_ASSET = /[/\\]assets[/\\][^/\\]+-[A-Za-z0-9_-]{8,}\.(js|css|mjs|woff2?|ttf|eot|svg|png|jpe?g|webp|gif|ico|map)$/i

const INDEX_HTML = /[/\\]index\.html$/i
const LOCALE_JSON = /[/\\]locales[/\\][^/\\]+\.json$/i

/**
 * Sets Cache-Control on dist/static responses so hashed Vite chunks cache long-term
 * while index.html and SPA shells stay fresh after deploy.
 */
export function applyStaticCacheHeaders (res, filePath) {
  const normalized = path.normalize(filePath)

  if (VITE_HASHED_ASSET.test(normalized)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return
  }

  if (INDEX_HTML.test(normalized)) {
    res.setHeader('Cache-Control', 'no-cache')
    return
  }

  if (LOCALE_JSON.test(normalized)) {
    res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate')
    return
  }

  res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate')
}

export function distStaticOptions () {
  return {
    index: false,
    setHeaders (res, filePath) {
      applyStaticCacheHeaders(res, filePath)
    }
  }
}
