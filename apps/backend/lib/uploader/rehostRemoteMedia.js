import { upload } from './index'

/**
 * Flatten image URL input into a list of individual http(s) URLs.
 * Accepts an array or a single string, and splits on whitespace so a pasted
 * block of URLs (or a Zapier text field) becomes multiple images.
 * @param {string[]|string|undefined|null} urls
 * @returns {string[]|undefined|null}
 */
export function normalizeImageUrls (urls) {
  if (!urls) return urls
  const list = Array.isArray(urls) ? urls : [urls]
  const out = []
  for (const item of list) {
    if (!item || typeof item !== 'string') continue
    for (const part of item.split(/\s+/)) {
      if (part) out.push(part)
    }
  }
  return out
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
