import { isURL } from 'validator'

export const sanitizeURL = (url) => {
  if (!url) return null
  if (isURL(url, { require_protocol: true })) return url
  if (isURL(`https://${url}`)) return `https://${url}`
  return null
}

/**
 * Normalizes a URL typed or pasted by a user so it is not treated as a path-relative link in the browser.
 * Keeps same-origin paths, hashes, mailto, tel, and URLs that already include a scheme.
 */
export function normalizeUserLinkHref (raw) {
  const url = (raw || '').trim()
  if (!url) return ''
  if (url.startsWith('/') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
    return url
  }
  if (url.startsWith('//')) {
    return `https:${url}`
  }
  if (/^[a-z][-a-z0-9+.]*:/i.test(url)) {
    return sanitizeURL(url) || url
  }
  return sanitizeURL(url) || url
}
