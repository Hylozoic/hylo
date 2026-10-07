import { URL } from 'react-native-url-polyfill'

const knownHyloOrigins = new Set([
  'https://hylo.com',
  'https://www.hylo.com',
  'https://staging.hylo.com'
])

const inlineMediaDomains = [
  'youtube.com',
  'youtube-nocookie.com',
  'vimeo.com',
  'soundcloud.com'
]

const externalProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:'])

function isWebUrl (rawUrl: string): boolean {
  try {
    const protocol = new URL(rawUrl).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}


export function isHyloWebUrl (rawUrl: string, webBaseUrl: string): boolean {
  return isWebUrl(rawUrl) && isInternalHyloOrigin(rawUrl, webBaseUrl)
}

function isInternalHyloOrigin (rawUrl: string, webBaseUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    const configuredOrigin = new URL(webBaseUrl).origin
    return url.origin === configuredOrigin || knownHyloOrigins.has(url.origin)
  } catch {
    return false
  }
}

export function shouldLoadInWebView (
  rawUrl: string,
  isTopFrame: boolean,
  webBaseUrl: string
): boolean {
  if (rawUrl === 'about:blank') return true
  if (isHyloWebUrl(rawUrl, webBaseUrl)) return true
  return !isTopFrame && isInlineMediaUrl(rawUrl)
}

function isInlineMediaUrl (rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return url.protocol === 'https:' && inlineMediaDomains.some(domain =>
      url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

export function canOpenExternalUrl (rawUrl: string): boolean {
  try {
    return externalProtocols.has(new URL(rawUrl).protocol)
  } catch {
    return false
  }
}

export function externalUrlForNavigation (rawUrl: string): string | null {
  if (canOpenExternalUrl(rawUrl)) return rawUrl
  if (!rawUrl.startsWith('intent://')) return null

  const intentOptionsIndex = rawUrl.indexOf('#Intent;')
  const intentUrl = intentOptionsIndex < 0 ? rawUrl : rawUrl.slice(0, intentOptionsIndex)
  const webUrl = `https:${intentUrl.slice('intent:'.length)}`
  if (isWebFallbackUrl(webUrl)) return webUrl

  const encodedFallbackUrl = rawUrl.match(/(?:^|;)S\.browser_fallback_url=([^;]*)/)?.[1]
  if (!encodedFallbackUrl) return null

  try {
    const fallbackUrl = decodeURIComponent(encodedFallbackUrl)
    return canOpenExternalUrl(fallbackUrl) ? fallbackUrl : null
  } catch {
    return null
  }
}

function isWebFallbackUrl (rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return isWebUrl(rawUrl) && (url.hostname.includes('.') || url.hostname === 'localhost')
  } catch {
    return false
  }
}
