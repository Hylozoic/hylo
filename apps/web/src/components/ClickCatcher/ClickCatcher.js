import React from 'react'
import { useNavigate } from 'react-router-dom'
import { mentionPath, origin, tagSearchUrl } from '@hylo/navigation'
import { staticPages } from '../../server/staticPages'

/**
 * Strips a leading www. so hylo.com and www.hylo.com compare as the same host.
 * @param {string} hostname
 * @returns {string}
 */
export function rootHostname (hostname) {
  return (hostname || '').replace(/^www\./i, '').toLowerCase()
}

/**
 * Returns the in-app path when href is on the current site's root domain.
 * Cross-subdomain hosts (e.g. staging.hylo.com while on hylo.com) are external.
 * @param {string} href
 * @param {string} [currentOrigin]
 * @returns {string|null}
 */
export function internalPathname (href, currentOrigin) {
  if (!href || typeof href !== 'string') return null

  const trimmed = href.trim()
  if (trimmed.startsWith('/')) return trimmed

  const resolvedOrigin = currentOrigin || origin()
  if (!resolvedOrigin) return null

  try {
    const current = new URL(resolvedOrigin)
    const url = new URL(trimmed, resolvedOrigin)
    if (rootHostname(url.hostname) !== rootHostname(current.hostname)) {
      return null
    }
    return `${url.pathname}${url.search}${url.hash}` || '/'
  } catch (e) {
    return null
  }
}

/**
 * True when the path is served by the static marketing site (not the SPA),
 * e.g. /agreements or /blog/some-post. The root path is left to the app.
 * @param {string} path
 * @returns {boolean}
 */
export function isStaticPagePath (path) {
  const pathname = path.split(/[?#]/)[0].replace(/\/$/, '')
  if (!pathname) return false
  return staticPages.includes(pathname) || pathname.startsWith('/blog/')
}

export default function ClickCatcher ({ handleMouseOver, groupSlug = 'all', onClick, ...props }) {
  const navigate = useNavigate()

  return React.createElement('span', { ...props, onClick: handleClick(navigate, groupSlug, onClick) })
}

export const handleClick = (navigate, groupSlug, onClick) => event => {
  const element = event.target

  if (!element?.closest) {
    onClick && onClick(event)
    return
  }

  const mentionEl = element.closest('.mention')
  if (mentionEl) {
    event.preventDefault()
    event.stopPropagation()
    return navigate(mentionPath(mentionEl.getAttribute('data-id'), groupSlug))
  }

  const topicEl = element.closest('.topic, .hashtag')
  if (topicEl) {
    event.preventDefault()
    event.stopPropagation()
    const tagName = topicEl.getAttribute('data-id') || topicEl.getAttribute('data-search') || topicEl.textContent
    return navigate(tagSearchUrl(tagName, { groupSlug }))
  }

  const anchorEl = element.closest('a')
  if (anchorEl) {
    const href = anchorEl.getAttribute('href')

    /*
      Only SPA-navigate when the link is on this site's root domain
      (www.hylo.com === hylo.com). Other Hylo environments, such as
      staging.hylo.com while on hylo.com, open in a new tab.
    */
    if (href) {
      const pathname = internalPathname(href, origin())

      if (pathname && !isStaticPagePath(pathname)) {
        event.preventDefault()

        return navigate(pathname)
      }

      anchorEl.setAttribute('target', '_blank')
    }

    return
  }

  onClick && onClick(event)
}
