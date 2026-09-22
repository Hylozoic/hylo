import { removePostFromUrl, groupUrl } from '@hylo/navigation'
import { isPhoneDevice } from 'util/mobile'

/**
 * Smart close (group all view, public, my groups, etc.) vs stripping /post/:id from the URL.
 * Isolated /post/:postId always; in-context routes (e.g. group view overlay) on phones only.
 *
 * @param {string} [view] Route view from useRouteParams (e.g. 'post', 'all')
 * @returns {boolean}
 */
export function shouldUseSmartPostClose (view) {
  return view === 'post' || isPhoneDevice()
}

function normalizePathname (pathname) {
  if (!pathname) return ''
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return trimmed || '/'
}

/**
 * True when `pathname` is a post overlay pushed on top of `previousLocation`.
 * @param {string} pathname
 * @param {{ pathname?: string }|null|undefined} previousLocation
 * @returns {boolean}
 */
export function isPostOverlayAbovePrevious (pathname, previousLocation) {
  if (!pathname || !previousLocation?.pathname) return false
  const parent = normalizePathname(removePostFromUrl(pathname) || '/')
  if (parent === normalizePathname(pathname)) return false
  return parent === normalizePathname(previousLocation.pathname)
}

/**
 * Leave a post opened over another route without keeping that post in history.
 * Pops when this entry was pushed on top of the parent page. Otherwise replaces
 * the current entry with the parent (direct links and refresh).
 * @param {object} opts
 * @param {(to: any, options?: object) => void} opts.navigate
 * @param {string} opts.pathname
 * @param {string} [opts.search]
 * @param {string} [opts.hash]
 * @param {{ pathname?: string }|null|undefined} opts.previousLocation
 * @param {boolean} opts.canGoBack
 */
export function closePostOverlay ({ navigate, pathname, search = '', hash = '', previousLocation, canGoBack }) {
  const parentPath = removePostFromUrl(pathname) || '/'
  if (canGoBack && isPostOverlayAbovePrevious(pathname, previousLocation)) {
    navigate(-1)
    return
  }
  navigate({
    pathname: parentPath,
    search: search || '',
    hash: hash || ''
  }, { replace: true })
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

/**
 * Chooses where to navigate when leaving post detail (close button, dialog dismiss, pull-to-close).
 * Applies whenever the post payload is available; otherwise callers should fall back to stripping `/post/:id` from the URL.
 *
 * @param {object} opts
 * @param {string} opts.pathname
 * @param {string} [opts.search]
 * @param {{ groups?: { id: string|number, slug?: string }[], isPublic?: boolean }|null} opts.post
 * @param {object|null|undefined} opts.me
 * @returns {{ pathname: string, search: string }}
 */
export function getPostDetailCloseDestination ({ pathname, search = '', post, me }) {
  const stripped = removePostFromUrl(pathname) || '/'
  const fallback = { pathname: stripped, search: search || '' }

  const groups = post?.groups
  if (!groups?.length) return fallback

  const myIds = new Set(memberGroupIdsFromMe(me))
  const memberOf = groups.filter(g => myIds.has(String(g.id)))
  const isPublic = !!post.isPublic
  const nG = groups.length
  const nM = memberOf.length

  if (nG === 1) {
    if (nM === 1 && groups[0].slug) {
      return { pathname: groupUrl(groups[0].slug, 'all'), search: '' }
    }
    if (!isPublic) return fallback
    return { pathname: '/public/all', search: '' }
  }

  if (nM === 0) {
    if (isPublic) return { pathname: '/public/all', search: '' }
    return { pathname: '/my/groups', search: '' }
  }

  if (nM === 1 && memberOf[0].slug) {
    return { pathname: groupUrl(memberOf[0].slug, 'all'), search: '' }
  }

  if (nM > 1) {
    return { pathname: '/my/groups', search: '' }
  }

  return fallback
}
