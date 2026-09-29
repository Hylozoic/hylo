import LRU from 'lru-cache'

/*
 * Serves the sitemap the backend builds daily (apps/backend/api/services/Sitemap.js).
 * The files live next to the other uploads; SITEMAP_SOURCE_URL is the public URL
 * of that folder, e.g. https://<bucket>.s3.amazonaws.com/<uploads prefix>/sitemaps
 *
 * /sitemap.xml            -> <SITEMAP_SOURCE_URL>/sitemap.xml
 * /sitemaps/sitemap-2.xml -> <SITEMAP_SOURCE_URL>/sitemap-2.xml
 *
 * A numbered part is served only while the current sitemap.xml index lists it, so
 * parts left over from a larger earlier sitemap are never served, and requests for
 * parts that don't exist are answered without asking storage.
 */

export const SITEMAP_ROUTES = ['/sitemap.xml', /^\/sitemaps\/sitemap-\d+\.xml$/]

const INDEX_FILE = 'sitemap.xml'
const CACHE_MAX_AGE_MS = 60 * 60 * 1000
// Missing files are remembered for less time, so a newly stored sitemap shows up soon
const MISSING_MAX_AGE_MS = 10 * 60 * 1000
const FETCH_TIMEOUT_MS = 5000
const MISSING = { missing: true }

export const sitemapCache = LRU({ max: 50, maxAge: CACHE_MAX_AGE_MS })

/**
 * The stored file name for a request path, or null when the path isn't a sitemap.
 * Only these exact names are ever fetched.
 */
export function sitemapFileForPath (path) {
  const pathname = String(path || '').split('?')[0]
  if (pathname === '/sitemap.xml') return INDEX_FILE
  const match = pathname.match(/^\/sitemaps\/(sitemap-\d+\.xml)$/)
  return match ? match[1] : null
}

/** Whether a sitemap index names this part, e.g. <loc>https://…/sitemaps/sitemap-2.xml</loc> */
export function indexListsPart (indexXml, file) {
  return String(indexXml || '').includes(`/sitemaps/${file}</loc>`)
}

function sendXml (res, xml) {
  res.set('Content-Type', 'application/xml; charset=utf-8')
  res.set('Cache-Control', 'public, max-age=3600')
  return res.status(200).send(xml)
}

/**
 * The stored file's XML, or null when it isn't there. Both are cached.
 * Throws when storage can't be reached.
 */
async function loadFile (source, file) {
  const cached = sitemapCache.get(file)
  if (cached === MISSING) return null
  if (cached) return cached

  const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
    ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
    : undefined
  const response = await fetch(`${source}/${file}`, { signal })
  if (!response.ok) {
    sitemapCache.set(file, MISSING, MISSING_MAX_AGE_MS)
    return null
  }
  const xml = await response.text()
  sitemapCache.set(file, xml)
  return xml
}

export async function handleSitemap (req, res, next) {
  const file = sitemapFileForPath(req.path || req.originalUrl)
  if (!file) return next()

  const source = (process.env.SITEMAP_SOURCE_URL || '').replace(/\/$/, '')
  if (!source) return res.status(404).send('Not found')

  try {
    const index = await loadFile(source, INDEX_FILE)
    if (file === INDEX_FILE) {
      return index ? sendXml(res, index) : res.status(404).send('Not found')
    }
    if (!index || !indexListsPart(index, file)) return res.status(404).send('Not found')
    const part = await loadFile(source, file)
    return part ? sendXml(res, part) : res.status(404).send('Not found')
  } catch (err) {
    console.error(`[sitemap] could not load ${file}: ${err.message}`)
    return res.status(502).send('Sitemap unavailable')
  }
}
