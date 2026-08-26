import React from 'react'
import { useNavigate } from 'react-router-dom'
import { HYLO_URL_REGEX, mentionPath, tagSearchUrl } from '@hylo/navigation'

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

  if (element.nodeName?.toLowerCase() === 'a') {
    const href = element.getAttribute('href')

    /*
      Matches for local links and forwards pathname to react router
      The matching could instead be skipped, relying upon  the `hylo-link`
      class which is added by the backend for the same match.
    */
    if (href) {
      let pathname
      const hyloLinkMatch = href.matchAll(HYLO_URL_REGEX).next()

      if (hyloLinkMatch?.value && hyloLinkMatch?.value?.length === 6) {
        pathname = hyloLinkMatch.value[5] === '' ? '/' : hyloLinkMatch.value[5]
      }

      if (href.match(/^\//)) {
        pathname = href
      }

      if (pathname) {
        event.preventDefault()

        return navigate(pathname)
      }

      // default to external link
      element.setAttribute('target', '_blank')
    }

    return
  }

  onClick && onClick(event)
}
