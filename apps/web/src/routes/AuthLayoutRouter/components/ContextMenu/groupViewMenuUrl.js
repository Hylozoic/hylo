import {
  groupUrl,
  localSpaceSlug,
  postUrl,
  personUrl,
  spaceHomeUrl,
  spaceGroupViewUrl,
  spaceUrl,
  viewUrl
} from '@hylo/navigation'
import { isDrawerNavLayout } from 'util/mobile'
import { sanitizeURL } from 'util/url'

/**
 * URL for opening a space from a menu.
 * On a drawer layout (mobile) the space index is the space's own menu (SpaceContent);
 * alongside a visible sidebar, go straight to the home view.
 */
export function spaceEntryUrl (parentSlug, spaceGroup) {
  if (!parentSlug || !spaceGroup?.slug) return parentSlug ? groupUrl(parentSlug) : '/'
  if (isDrawerNavLayout()) {
    return spaceUrl(parentSlug, localSpaceSlug(parentSlug, spaceGroup.slug))
  }
  return spaceHomeUrl(parentSlug, spaceGroup)
}

/**
 * Absolute http(s) href for a stored link, adding https:// when the value has no scheme.
 * Returns null for missing, internal (e.g. /u/123), or non-http(s) values.
 */
export function externalLinkHref (view) {
  if (!view?.link) return null
  const href = sanitizeURL(view.link)
  return href && /^https?:\/\//i.test(href) ? href : null
}

/** Resolves a URL for static My/Public/All context menu views. */
export function contextViewUrl (view) {
  if (view?.link) return externalLinkHref(view) || view.link
  if (view?.context && view?.type) {
    return viewUrl(view.type, { context: view.context })
  }
  return null
}

/** Maps a GroupView to its URL within a group's route tree. Falls back to the group home. */
export function groupViewUrl (groupSlug, view) {
  if (!view || !groupSlug) return groupUrl(groupSlug)

  switch (view.type) {
    case 'post':
      return view.viewPost?.id ? postUrl(view.viewPost.id, { groupSlug, context: 'groups' }) : groupUrl(groupSlug)
    case 'group':
      return view.linkedGroup?.slug ? groupUrl(view.linkedGroup.slug) : groupUrl(groupSlug)
    case 'member':
      return view.viewUser?.id ? personUrl(view.viewUser.id, groupSlug) : groupUrl(groupSlug)
    case 'all':
      return groupUrl(groupSlug, 'all')
    case 'chat':
      return groupUrl(groupSlug, 'chat')
    case 'events':
      return groupUrl(groupSlug, 'events')
    case 'map':
      return groupUrl(groupSlug, 'map')
    case 'members':
      return groupUrl(groupSlug, 'members')
    case 'about':
      return groupUrl(groupSlug, 'about')
    case 'welcome':
      return groupUrl(groupSlug, 'welcome')
    case 'discussions':
      return groupUrl(groupSlug, 'discussions')
    case 'proposals':
      return groupUrl(groupSlug, 'proposals')
    case 'projects':
      return groupUrl(groupSlug, 'projects')
    case 'resources':
      return groupUrl(groupSlug, 'resources')
    case 'requests-and-offers':
      return groupUrl(groupSlug, 'requests-and-offers')
    case 'related-groups':
      return groupUrl(groupSlug, 'groups')
    case 'moderation':
      return groupUrl(groupSlug, 'moderation')
    case 'decisions':
      return groupUrl(groupSlug, 'decisions')
    case 'custom':
      return groupUrl(groupSlug, `custom/${view.id}`)
    case 'collection':
      return groupUrl(groupSlug, `collection/${view.id}`)
    case 'track-actions':
      return groupUrl(groupSlug, 'track-actions')
    case 'funding-round-submissions':
      return groupUrl(groupSlug, 'funding-round-submissions')
    case 'manage-round':
      return groupUrl(groupSlug, 'manage-round')
    case 'space':
      return view.linkedGroup ? spaceEntryUrl(groupSlug, view.linkedGroup) : groupUrl(groupSlug)
    case 'link':
      return externalLinkHref(view) || view.link || null
    default:
      return groupUrl(groupSlug, view.type || 'all')
  }
}

/** Resolves menu URL for a view — space sub-items use the parent/space URL pattern. */
export function menuViewUrl (parentSlug, view, spaceGroup = null) {
  if (view?.link || view?.context) return contextViewUrl(view)
  if (spaceGroup) {
    const url = spaceGroupViewUrl(parentSlug, spaceGroup, view)
    if (url) return url
    return spaceEntryUrl(parentSlug, spaceGroup)
  }
  if (view?.type === 'space' && view.linkedGroup) {
    return spaceEntryUrl(parentSlug, view.linkedGroup)
  }
  return groupViewUrl(parentSlug, view)
}
