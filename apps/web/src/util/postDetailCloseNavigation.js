import { removePostFromUrl, groupUrl } from '@hylo/navigation'
import { isPhoneDevice } from 'util/mobile'

/**
 * Smart close (group stream, public, my groups, etc.) vs stripping /post/:id from the URL.
 * Isolated /post/:postId always; in-context routes (e.g. group stream overlay) on phones only.
 *
 * @param {string} [view] Route view from useRouteParams (e.g. 'post', 'stream')
 * @returns {boolean}
 */
export function shouldUseSmartPostClose (view) {
  return view === 'post' || isPhoneDevice()
}

/**
 * Returns group ids the current user belongs to (from Me.memberships).
 * @param {{ memberships?: { toModelArray: () => { group: { id: string|number } }[] } }} me
 * @returns {string[]}
 */
export function memberGroupIdsFromMe (me) {
  if (!me?.memberships?.toModelArray) return []
  try {
    return me.memberships.toModelArray().map(m => String(m.group.id))
  } catch (e) {
    return []
  }
}

/** Me must be in the store with memberships before smart-close can infer group streams. */
export function meMembershipsReady (me) {
  return Boolean(me?.memberships?.toModelArray)
}

/**
 * Chooses where to navigate when leaving post detail (close button, dialog dismiss, pull-to-close).
 * Applies whenever the post payload is available; otherwise callers should fall back to stripping `/post/:id` from the URL.
 *
 * @param {object} opts
 * @param {string} opts.pathname
 * @param {string} [opts.search]
 * @param {{ groups?: { id: string|number, slug?: string }[], isPublic?: boolean }|null} opts.post
 * @param {object|null|undefined} opts.me
 * @returns {{ pathname: string, search: string }|null} null when Me memberships are not ready yet
 */
export function getPostDetailCloseDestination ({ pathname, search = '', post, me }) {
  const stripped = removePostFromUrl(pathname) || '/'
  const fallback = { pathname: stripped, search: search || '' }

  const groups = post?.groups
  if (!groups?.length) return fallback

  if (!meMembershipsReady(me)) return null

  const myIds = new Set(memberGroupIdsFromMe(me))
  const memberOf = groups.filter(g => myIds.has(String(g.id)))
  const isPublic = !!post.isPublic
  const nG = groups.length
  const nM = memberOf.length

  if (nG === 1) {
    if (nM === 1 && groups[0].slug) {
      return { pathname: groupUrl(groups[0].slug, 'stream'), search: '' }
    }
    if (!isPublic) return fallback
    return { pathname: '/public/stream', search: '' }
  }

  if (nM === 0) {
    if (isPublic) return { pathname: '/public/stream', search: '' }
    return { pathname: '/my/groups', search: '' }
  }

  if (nM === 1 && memberOf[0].slug) {
    return { pathname: groupUrl(memberOf[0].slug, 'stream'), search: '' }
  }

  if (nM > 1) {
    return { pathname: '/my/groups', search: '' }
  }

  return fallback
}
