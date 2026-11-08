import path from 'path'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

// Vite names build output `name.<hash>.ext` (see vite.config.js). Public files
// copied into dist/assets (fonts, logos) have no hash segment and must not
// be cached as immutable.
const HASHED_ASSET = /\.[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/

/** Cache policy for one file served from dist, or null to leave the default. */
export function cacheControlForStaticFile (filePath) {
  const base = path.basename(filePath)
  if (base === 'index.html') return 'no-cache'
  if (HASHED_ASSET.test(base)) return `public, max-age=${ONE_YEAR_SECONDS}, immutable`
  return null
}

/** Applies long-cache headers to content-hashed build files and no-cache to index.html. */
export function setStaticCacheHeaders (res, filePath) {
  const value = cacheControlForStaticFile(filePath)
  if (value) res.setHeader('Cache-Control', value)
}
