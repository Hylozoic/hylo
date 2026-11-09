import { upload } from './index'

/**
 * Collect URL strings from a flat list, a nested list (Zapier line items),
 * or a JSON-encoded list that arrived as one string.
 * @param {*} value
 * @param {string[]} out
 */
function collectImageUrls (value, out) {
  if (value == null || value === '') return
  if (Array.isArray(value)) {
    for (const item of value) collectImageUrls(item, out)
    return
  }
  if (typeof value !== 'string') return

  const trimmed = value.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        collectImageUrls(parsed, out)
        return
      }
    } catch (err) {
      // A leading "[" that is not a JSON list is still a URL.
    }
  }

  for (const part of trimmed.split(/\s+/)) {
    if (part) out.push(part)
  }
}

/**
 * Flatten image URL input into a list of individual http(s) URLs.
 * Accepts a string, a flat list, or a nested list, and splits on whitespace
 * so a pasted block of URLs (or a Zapier text field) becomes multiple images.
 * @param {string[]|string[][]|string|undefined|null} urls
 * @returns {string[]|undefined|null}
 */
export function normalizeImageUrls (urls) {
  if (!urls) return urls
  const out = []
  collectImageUrls(urls, out)
  return out
}

/**
 * Rewrite every imageUrls value in a GraphQL variables object in place.
 * PostInput.imageUrls is [String], so a Zapier line-item list ([[url]]) has to
 * be flattened before GraphQL coerces the variables.
 * @param {*} variables
 * @returns {*}
 */
export function flattenImageUrlVariables (variables) {
  walkImageUrlFields(variables)
  return variables
}

/** @param {*} value */
function walkImageUrlFields (value) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) walkImageUrlFields(item)
    return
  }
  if (Object.prototype.hasOwnProperty.call(value, 'imageUrls')) {
    value.imageUrls = normalizeImageUrls(value.imageUrls)
  }
  for (const nested of Object.values(value)) walkImageUrlFields(nested)
}

/**
 * Whether a URL is already stored on Hylo's S3/CDN.
 * @param {*} url
 * @returns {boolean}
 */
export function isHyloHostedUrl (url) {
  if (!url || typeof url !== 'string') return false
  if (url.includes('/evo-uploads/')) return true
  const contentUrl = process.env.AWS_S3_CONTENT_URL
  if (contentUrl && url.startsWith(contentUrl)) return true
  const host = process.env.UPLOADER_HOST
  if (host && url.includes(host)) return true
  return false
}

/**
 * Split image URLs into those already on Hylo storage vs remote URLs that need re-hosting.
 * When `urls` is absent, `hosted` stays absent so callers do not treat it as "remove all images".
 * @param {string[]|string|undefined|null} urls
 * @returns {{ hosted: string[]|undefined|null, remote: string[] }}
 */
export function partitionImageUrls (urls) {
  if (!urls) return { hosted: urls, remote: [] }
  const hosted = []
  const remote = []
  for (const url of normalizeImageUrls(urls)) {
    if (isHyloHostedUrl(url)) hosted.push(url)
    else remote.push(url)
  }
  return { hosted, remote }
}

/**
 * Download a remote file and store it on S3, returning the hosted URL.
 * Uses type `post` and id `new` (same path as the post editor) so this can run
 * as a background job without an extra permission check against the post author.
 * @param {string} url - Remote image URL (e.g. an Airtable attachment)
 * @param {{ userId: string|number }} opts
 * @returns {Promise<string>}
 */
export async function rehostRemoteUrl (url, { userId }) {
  const result = await upload({
    type: 'post',
    id: 'new',
    userId,
    url
  })
  return result.url
}
