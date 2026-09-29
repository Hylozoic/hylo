import LRU from 'lru-cache'

/*
 * Serves the sitemap the backend builds daily (apps/backend/api/services/Sitemap.js).
 * The files live next to the other uploads; SITEMAP_SOURCE_URL is the public URL
 * of that folder, e.g. https://<bucket>.s3.amazonaws.com/<uploads prefix>/sitemaps
 *
 * /sitemap.xml            -> <SITEMAP_SOURCE_URL>/sitemap.xml
 * /sitemaps/sitemap-2.xml -> <SITEMAP_SOURCE_URL>/sitemap-2.xml
 */

export const SITEMAP_ROUTES = ['/sitemap.xml', /^\/sitemaps\/sitemap-\d+\.xml$/]

const CACHE_MAX_AGE_MS = 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 5000

export const sitemapCache = LRU({ max: 50, maxAge: CACHE_MAX_AGE_MS })

/**
 * The stored file name for a request path, or null when the path isn't a sitemap.
 * Only these exact names are ever fetched.
 */
export function sitemapFileForPath (path) {
  const pathname = String(path || '').split('?')[0]
  if (pathname === '/sitemap.xml') return 'sitemap.xml'
  const match = pathname.match(/^\/sitemaps\/(sitemap-\d+\.xml)$/)
  return match ? match[1] : null
}

function sendXml (res, xml) {
  res.set('Content-Type', 'application/xml; charset=utf-8')
  res.set('Cache-Control', 'public, max-age=3600')
  return res.status(200).send(xml)
}

export async function handleSitemap (req, res, next) {
  const file = sitemapFileForPath(req.path || req.originalUrl)
  if (!file) return next()

  const source = (process.env.SITEMAP_SOURCE_URL || '').replace(/\/$/, '')
  if (!source) return res.status(404).send('Not found')

  const cached = sitemapCache.get(file)
  if (cached) return sendXml(res, cached)

  try {
    const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
      ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
      : undefined
    const response = await fetch(`${source}/${file}`, { signal })
    if (!response.ok) return res.status(404).send('Not found')
    const xml = await response.text()
    sitemapCache.set(file, xml)
    return sendXml(res, xml)
  } catch (err) {
    console.error(`[sitemap] could not load ${file}: ${err.message}`)
    return res.status(502).send('Sitemap unavailable')
  }
}
