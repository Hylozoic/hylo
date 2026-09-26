import * as TextHelpers from '@hylo/shared/TextHelpers'

const MAX_DESCRIPTION_LENGTH = 144
const POST_ID_PATH = /\/post\/(\d+)(?:\/|$)/

/** Extracts a numeric post id from a Hylo post URL path, or null. */
export function extractPostIdFromPath (path) {
  if (!path) return null
  const pathname = String(path).split('?')[0]
  const match = pathname.match(POST_ID_PATH)
  return match ? match[1] : null
}

/** Escapes a string for use in an HTML attribute. */
export function escapeHtmlAttr (value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** The scheme and host the request came in on, honouring the load balancer's forwarded scheme. */
export function requestOrigin (req) {
  const forwardedProto = req.get?.('x-forwarded-proto') || req.headers?.['x-forwarded-proto']
  const protocol = String(forwardedProto || req.protocol || 'https').split(',')[0].trim()
  const host = req.get?.('host') || req.headers?.host || ''
  return host ? `${protocol}://${host}` : ''
}

/**
 * Builds Open Graph / Twitter meta tags. Description tags are left out when description is null.
 * @returns {string} HTML to inject into <head>
 */
export function buildMetaTagHtml ({ title, description = null, imageUrl, url, type = 'article', twitterCard }) {
  const safeTitle = escapeHtmlAttr(title)
  const safeUrl = escapeHtmlAttr(url)
  const tags = [
    `<title>${safeTitle}</title>`,
    `<meta property="og:type" content="${escapeHtmlAttr(type)}" />`,
    '<meta property="og:site_name" content="Hylo" />',
    `<meta property="og:title" content="${safeTitle}" />`,
    `<meta name="twitter:title" content="${safeTitle}" />`
  ]

  if (description !== null) {
    const safeDescription = escapeHtmlAttr(description)
    tags.push(`<meta name="description" content="${safeDescription}" />`)
    tags.push(`<meta property="og:description" content="${safeDescription}" />`)
    tags.push(`<meta name="twitter:description" content="${safeDescription}" />`)
  }

  if (safeUrl) {
    tags.push(`<meta property="og:url" content="${safeUrl}" />`)
  }

  if (imageUrl) {
    const safeImage = escapeHtmlAttr(imageUrl)
    tags.push(`<meta property="og:image" content="${safeImage}" />`)
    tags.push(`<meta name="twitter:card" content="${twitterCard || 'summary_large_image'}" />`)
    tags.push(`<meta name="twitter:image" content="${safeImage}" />`)
  } else {
    tags.push('<meta name="twitter:card" content="summary" />')
  }

  return tags.join('\n    ')
}

/** Builds Open Graph / Twitter meta tags for a public post. */
export function buildPostMetaTagHtml ({ title, description, imageUrl, url }) {
  return buildMetaTagHtml({ title, description: description ?? '', imageUrl, url, type: 'article' })
}

/** Replaces the default <title> and inserts OG tags before </head>. */
export function injectPostMetaTagsIntoHtml (html, metaHtml) {
  if (!html || !metaHtml) return html
  const next = html.replace(/<title>[^<]*<\/title>/i, '')
  if (next.includes('</head>')) {
    return next.replace('</head>', `    ${metaHtml}\n  </head>`)
  }
  return next
}

/**
 * Maps a public GraphQL post into preview fields: title, plain-text body, first image.
 */
export function presentPublicPostMeta (post) {
  if (!post) return null
  const description = TextHelpers.presentHTMLToText(post.details, { truncate: MAX_DESCRIPTION_LENGTH })
  const title = post.title || description || 'Hylo'
  const attachments = post.attachments || []
  const firstImage = attachments
    .filter(a => a?.type === 'image' && a?.url)
    .sort((a, b) => (a.position || 0) - (b.position || 0))[0]

  return {
    title,
    description,
    imageUrl: firstImage?.url || null
  }
}

const PUBLIC_POST_META_QUERY = `
  query PublicPostMeta ($id: ID) {
    post (id: $id) {
      id
      title
      details
      attachments {
        type
        url
        position
      }
    }
  }
`

/** Fetches a public post for OG tags. Unauthenticated GraphQL only returns public posts. */
export async function fetchPublicPostMeta (postId, { fetchImpl = fetch, apiHost } = {}) {
  const host = apiHost || process.env.VITE_API_HOST || 'http://localhost:3001'
  const response = await fetchImpl(`${host}/noo/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: PUBLIC_POST_META_QUERY,
      variables: { id: postId }
    })
  })

  if (!response.ok) return null
  const result = await response.json()
  return presentPublicPostMeta(result?.data?.post)
}

/**
 * If the request is for a public post, injects title / description / image meta tags.
 * Failures are ignored so the SPA still loads.
 */
export async function withPublicPostMetaTags (html, req, opts = {}) {
  const path = (req.originalUrl || req.url || '').split('?')[0]
  const postId = extractPostIdFromPath(path)
  if (!postId) return html

  try {
    const meta = await fetchPublicPostMeta(postId, opts)
    if (!meta) return html

    const url = `${requestOrigin(req)}${path}`
    const metaHtml = buildPostMetaTagHtml({ ...meta, url })
    return injectPostMetaTagsIntoHtml(html, metaHtml)
  } catch (err) {
    console.error('Failed to inject public post meta tags:', err.message)
    return html
  }
}
