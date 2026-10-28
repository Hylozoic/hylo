import LRU from 'lru-cache'
import * as TextHelpers from '@hylo/shared/TextHelpers'
import {
  buildMetaTagHtml,
  escapeHtmlAttr,
  extractPostIdFromPath,
  injectPostMetaTagsIntoHtml,
  requestOrigin
} from './postMetaTags.js'

const MAX_DESCRIPTION_LENGTH = 144
const PUBLIC_VISIBILITY = 2
const DEFAULT_IMAGE_PATH = '/hylo-merkaba.png'
const FETCH_TIMEOUT_MS = 2000
const GROUP_PATH = /^\/groups\/([^/]+)(?:\/(.*))?$/
const JOIN_PATH = /^join\/([^/]+)/
const USE_INVITATION_PATH = '/h/use-invitation'

// Keyed by group and credentials, so every page of a group shares one lookup
export const groupMetaCache = LRU({ max: 500, maxAge: 5 * 60 * 1000 })

const safeDecode = value => {
  try {
    return decodeURIComponent(value)
  } catch (e) {
    return value
  }
}

/**
 * Works out which group a URL previews and the credentials that unlock it.
 * Post URLs are left to the post injector.
 * @returns {{ slug?: string, accessCode?: string, invitationToken?: string } | null}
 */
export function resolveGroupMetaRoute (path, query = {}) {
  const pathname = String(path || '').split('?')[0]
  if (extractPostIdFromPath(pathname)) return null

  if (pathname.replace(/\/$/, '') === USE_INVITATION_PATH) {
    const token = Array.isArray(query.token) ? query.token[0] : query.token
    return token ? { invitationToken: String(token) } : null
  }

  const match = pathname.match(GROUP_PATH)
  if (!match) return null
  const slug = safeDecode(match[1])
  const join = (match[2] || '').match(JOIN_PATH)
  return join ? { slug, accessCode: safeDecode(join[1]) } : { slug }
}

const isShareableImage = url => /^https?:\/\//i.test(url || '') && !/\.svg(\?|#|$)/i.test(url)

/**
 * Maps a GraphQL group into preview fields. Only public groups get a description:
 * a join link or invitation can unlock a group that is not public.
 */
export function presentGroupMeta (group) {
  if (!group?.name) return null
  const isPublic = Number(group.visibility) === PUBLIC_VISIBILITY
  const bannerUrl = isShareableImage(group.bannerUrl) ? group.bannerUrl : null
  const avatarUrl = isShareableImage(group.avatarUrl) ? group.avatarUrl : null
  return {
    title: group.name,
    description: isPublic
      ? TextHelpers.presentHTMLToText(group.description || group.purpose || '', { truncate: MAX_DESCRIPTION_LENGTH }) || null
      : null,
    imageUrl: bannerUrl || avatarUrl,
    largeImage: !!bannerUrl
  }
}

const GROUP_META_QUERY = `
  query GroupMeta ($slug: String, $accessCode: String, $invitationToken: String) {
    group (slug: $slug, accessCode: $accessCode, invitationToken: $invitationToken) {
      name
      description
      purpose
      avatarUrl
      bannerUrl
      visibility
    }
  }
`

const CHECK_INVITATION_QUERY = `
  query GroupMetaInvitation ($invitationToken: String) {
    checkInvitation (invitationToken: $invitationToken) {
      valid
      groupSlug
    }
  }
`

async function queryApi (query, variables, { fetchImpl = fetch, apiHost } = {}) {
  const host = apiHost || process.env.VITE_API_HOST || 'http://localhost:3001'
  const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
    ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
    : undefined
  const response = await fetchImpl(`${host}/noo/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal
  })
  if (!response.ok) throw new Error(`Group meta lookup failed with status ${response.status}`)
  const result = await response.json()
  return result?.data
}

/**
 * Fetches preview fields through the signed-out API, which only returns a public group
 * unless a valid access code or invitation token for it is passed.
 * Resolves to null when there is nothing to show; rejects when the API can't be reached.
 */
export async function fetchGroupMeta (route, opts = {}) {
  let { slug, accessCode, invitationToken } = route
  if (!slug && invitationToken) {
    const data = await queryApi(CHECK_INVITATION_QUERY, { invitationToken }, opts)
    if (!data?.checkInvitation?.valid || !data.checkInvitation.groupSlug) return null
    slug = data.checkInvitation.groupSlug
  }
  if (!slug) return null
  const data = await queryApi(GROUP_META_QUERY, { slug, accessCode, invitationToken }, opts)
  return presentGroupMeta(data?.group)
}

async function cachedGroupMeta (route, opts) {
  const key = JSON.stringify([route.slug || null, route.accessCode || null, route.invitationToken || null])
  if (groupMetaCache.has(key)) return groupMetaCache.get(key)
  const meta = await fetchGroupMeta(route, opts)
  groupMetaCache.set(key, meta)
  return meta
}

/**
 * Injects link preview tags for group pages, join links and email invitation links.
 * Failures are ignored so the SPA still loads.
 */
export async function withGroupMetaTags (html, req, opts = {}) {
  const path = (req.originalUrl || req.url || '').split('?')[0]
  const route = resolveGroupMetaRoute(path, req.query)
  if (!route) return html

  try {
    const meta = await cachedGroupMeta(route, opts)
    if (!meta) return html

    const origin = requestOrigin(req)
    const metaHtml = buildMetaTagHtml({
      title: meta.title,
      description: meta.description,
      imageUrl: meta.imageUrl || `${origin}${DEFAULT_IMAGE_PATH}`,
      twitterCard: meta.largeImage ? 'summary_large_image' : 'summary',
      // The invitation token lives in the query string, which a canonical URL would drop
      url: route.invitationToken ? null : `${origin}${path}`,
      type: 'website'
    })
    return injectPostMetaTagsIntoHtml(html, metaHtml)
  } catch (err) {
    console.error('Failed to inject group meta tags:', err.message)
    return html
  }
}

/** Adds Hylo's own preview tags to any page that did not get more specific ones. */
export function withDefaultMetaTags (html, req) {
  if (!html || /property="og:title"/.test(html)) return html
  const imageUrl = escapeHtmlAttr(`${requestOrigin(req)}${DEFAULT_IMAGE_PATH}`)
  const tags = [
    '<title>Hylo</title>',
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="Hylo" />',
    '<meta property="og:title" content="Hylo" />',
    `<meta property="og:image" content="${imageUrl}" />`,
    '<meta name="twitter:card" content="summary" />'
  ]
  return injectPostMetaTagsIntoHtml(html, tags.join('\n    '))
}
