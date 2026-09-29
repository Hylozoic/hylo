import LRU from 'lru-cache'
import { readFileSync } from 'fs'
import root from 'root-path'
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

// The web app's languages; the default preview description is read from their locale files
export const PREVIEW_LOCALES = ['en', 'de', 'es', 'fr', 'hi', 'pt']
export const DEFAULT_DESCRIPTION_KEY = 'hyloDefaultDescription'
const LOCALE_DIRS = ['public/locales', 'dist/locales']
const defaultDescriptions = {}

/**
 * Picks the preview language from an Accept-Language header, by quality then
 * order, matching on the primary subtag (fr-CA reads as fr). English when none match.
 */
export function localeFromAcceptLanguage (header) {
  const ranked = String(header || '')
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';')
      const qParam = params.map(p => p.trim()).find(p => p.startsWith('q='))
      const q = qParam ? Number(qParam.slice(2)) : 1
      return { lang: tag.trim().toLowerCase().split('-')[0], q: Number.isFinite(q) ? q : 0, index }
    })
    .filter(entry => entry.lang && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
  const match = ranked.find(entry => PREVIEW_LOCALES.includes(entry.lang))
  return match ? match.lang : 'en'
}

function readLocaleString (locale, key) {
  for (const dir of LOCALE_DIRS) {
    try {
      const strings = JSON.parse(readFileSync(root(`${dir}/${locale}.json`), { encoding: 'utf-8' }))
      if (strings[key]) return strings[key]
    } catch (e) {
      // try the next place the locale files may live
    }
  }
  return null
}

/** The homepage line used as the default link preview description, in the given language. */
export function defaultPreviewDescription (locale, { readString = readLocaleString } = {}) {
  const lang = PREVIEW_LOCALES.includes(locale) ? locale : 'en'
  if (!(lang in defaultDescriptions)) {
    defaultDescriptions[lang] = readString(lang, DEFAULT_DESCRIPTION_KEY) ||
      (lang === 'en' ? null : defaultPreviewDescription('en', { readString }))
  }
  return defaultDescriptions[lang]
}

/** Forget cached descriptions; for tests. */
export function resetDefaultPreviewDescriptions () {
  Object.keys(defaultDescriptions).forEach(key => { delete defaultDescriptions[key] })
}

const acceptLanguage = req => req.get?.('accept-language') || req.headers?.['accept-language'] || ''

/** Adds Hylo's own preview tags to any page that did not get more specific ones. */
export function withDefaultMetaTags (html, req, opts = {}) {
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
  const description = defaultPreviewDescription(localeFromAcceptLanguage(acceptLanguage(req)), opts)
  if (description) {
    const safeDescription = escapeHtmlAttr(description)
    if (!/name="description"/.test(html)) tags.push(`<meta name="description" content="${safeDescription}" />`)
    tags.push(`<meta property="og:description" content="${safeDescription}" />`)
    tags.push(`<meta name="twitter:description" content="${safeDescription}" />`)
  }
  return injectPostMetaTagsIntoHtml(html, tags.join('\n    '))
}
