import { toPlainText as ogPlainText } from './ogText.js'
import {
  escapeHtmlAttr,
  extractPostIdFromPath,
  injectPostMetaTagsIntoHtml
} from './postMetaTags.js'

const MAX_DESCRIPTION_LENGTH = 144
const GROUP_VISIBILITY_PUBLIC = 2
const GROUP_SLUG_PATH = /^\/groups\/([^/]+)(?:\/|$)/
const SPACE_SLUG_PATH = /^\/groups\/[^/]+\/spaces\/([^/]+)(?:\/|$)/

/** Stored space slug (`{parentSlug}-{localSlug}`). Does not double-prefix. */
function storedSpaceSlug (parentSlug, localSlug) {
  if (!parentSlug || !localSlug) return localSlug || ''
  const prefix = `${parentSlug}-`
  return localSlug.startsWith(prefix) ? localSlug : `${prefix}${localSlug}`
}

/** Extracts a group or nested space slug from a Hylo group URL path, or null. */
export function extractGroupSlugFromPath (path) {
  if (!path) return null
  const pathname = String(path).split('?')[0]
  const spaceMatch = pathname.match(SPACE_SLUG_PATH)
  if (spaceMatch) {
    const parentSlug = pathname.match(GROUP_SLUG_PATH)?.[1]
    return storedSpaceSlug(parentSlug, spaceMatch[1])
  }
  const match = pathname.match(GROUP_SLUG_PATH)
  return match ? match[1] : null
}

/**
 * Maps a public GraphQL group into preview fields: title, purpose/description, avatar.
 * @returns {{ title: string, description: string, imageUrl: string|null }|null}
 */
export function presentPublicGroupMeta (group) {
  if (!group) return null
  if (group.visibility != null && group.visibility !== GROUP_VISIBILITY_PUBLIC) return null

  const description = ogPlainText(group.purpose, MAX_DESCRIPTION_LENGTH) || ogPlainText(group.description, MAX_DESCRIPTION_LENGTH)
  const name = (group.name || '').trim()

  return {
    title: name ? `${name} | Hylo` : 'Hylo',
    description,
    imageUrl: group.avatarUrl || null
  }
}

/**
 * Builds Open Graph / Twitter meta tags for a public group.
 * @returns {string} HTML to inject into <head>
 */
export function buildGroupMetaTagHtml ({ title, description, imageUrl, url }) {
  const safeTitle = escapeHtmlAttr(title)
  const safeDescription = escapeHtmlAttr(description)
  const safeUrl = escapeHtmlAttr(url)
  const tags = [
    `<title>${safeTitle}</title>`,
    `<meta name="description" content="${safeDescription}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="Hylo" />',
    `<meta property="og:title" content="${safeTitle}" />`,
    `<meta property="og:description" content="${safeDescription}" />`,
    `<meta name="twitter:title" content="${safeTitle}" />`,
    `<meta name="twitter:description" content="${safeDescription}" />`
  ]

  if (safeUrl) {
    tags.push(`<meta property="og:url" content="${safeUrl}" />`)
  }

  if (imageUrl) {
    const safeImage = escapeHtmlAttr(imageUrl)
    tags.push(`<meta property="og:image" content="${safeImage}" />`)
    tags.push('<meta name="twitter:card" content="summary" />')
    tags.push(`<meta name="twitter:image" content="${safeImage}" />`)
  } else {
    tags.push('<meta name="twitter:card" content="summary" />')
  }

  return tags.join('\n    ')
}

/** Turns a relative avatar path into an absolute URL for crawlers. */
function toAbsoluteUrl (url, protocol, host) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  if (!host) return url
  const path = url.startsWith('/') ? url : `/${url}`
  return `${protocol}://${host}${path}`
}

const PUBLIC_GROUP_META_QUERY = `
  query PublicGroupMeta ($slug: String) {
    group (slug: $slug) {
      id
      name
      purpose
      description
      avatarUrl
      visibility
    }
  }
`

/** Fetches a public group for OG tags. Unauthenticated GraphQL only returns public groups. */
export async function fetchPublicGroupMeta (slug, { fetchImpl = fetch, apiHost } = {}) {
  const host = apiHost || process.env.VITE_API_HOST || 'http://localhost:3001'
  const response = await fetchImpl(`${host}/noo/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: PUBLIC_GROUP_META_QUERY,
      variables: { slug }
    })
  })

  if (!response.ok) return null
  const result = await response.json()
  return presentPublicGroupMeta(result?.data?.group)
}

/**
 * If the request is for a public group (and not a post URL), injects OG meta tags.
 * Failures are ignored so the SPA still loads.
 */
export async function withPublicGroupMetaTags (html, req, opts = {}) {
  const path = (req.originalUrl || req.url || '').split('?')[0]
  if (extractPostIdFromPath(path)) return html

  const slug = extractGroupSlugFromPath(path)
  if (!slug) return html

  try {
    const meta = await fetchPublicGroupMeta(slug, opts)
    if (!meta) return html

    const protocol = req.protocol || 'https'
    const host = req.get?.('host') || req.headers?.host || ''
    const url = host ? `${protocol}://${host}${path}` : path
    const imageUrl = toAbsoluteUrl(meta.imageUrl, protocol, host)
    const metaHtml = buildGroupMetaTagHtml({ ...meta, imageUrl, url })
    return injectPostMetaTagsIntoHtml(html, metaHtml)
  } catch (err) {
    console.error('Failed to inject public group meta tags:', err.message)
    return html
  }
}
