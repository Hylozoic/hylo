import get from 'lodash/fp/get.js'
import isEmpty from 'lodash/fp/isEmpty.js'
import isNumber from 'lodash/fp/isNumber.js'
import omitBy from 'lodash/fp/omitBy.js'

// https://regex101.com/r/0M6mbp/1
export const HYLO_URL_REGEX = /^(https?:\/?\/?)?(www\.|staging\.)?(hylo\.com|localhost)(:?\d{0,6})(.*)/gi

export const ALL_GROUPS_CONTEXT_SLUG = 'all'
export const MESSAGES_CONTEXT_SLUG = 'messages'
export const MY_CONTEXT_SLUG = 'my'
export const PUBLIC_CONTEXT_SLUG = 'public'
export const SEARCH_CONTEXT_SLUG = 'search'

export const isStaticContext = contextOrSlug =>
  [PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG, SEARCH_CONTEXT_SLUG].includes(contextOrSlug?.slug || contextOrSlug)

export const HYLO_ID_MATCH = '\\d+'
export const POST_ID_MATCH = HYLO_ID_MATCH
const GROUP_SLUG_MATCH = '[^\\\\]+'
// TODO: do this validation elsewhere?
export const OPTIONAL_POST_MATCH = ':detail(post)?/:postId?/:action(new|edit)?'
export const OPTIONAL_NEW_POST_MATCH = ':detail(post)?/:action(new)?' // TODO: need this?
export const POST_DETAIL_MATCH = 'post/:postId/comments?/:commentId?/*'

export const REQUIRED_EDIT_POST_MATCH = ':detail(post)/:postId/:action(edit)'

export const GROUP_DETAIL_MATCH = 'group/:detailGroupSlug'
export const OPTIONAL_GROUP_MATCH = ':detail(group)?/(:detailGroupSlug)?'

// Fundamental URL paths

export function allGroupsUrl () {
  return '/all'
}

export function publicGroupsUrl () {
  return '/public'
}

export function myHomeUrl () {
  return '/my'
}

export function searchUrl () {
  return '/search'
}

export function baseUrl ({
  context,
  customViewId,
  defaultUrl = allGroupsUrl(),
  fundingRoundId,
  groupSlug,
  memberId, personId, // TODO: switch to one of these?
  spaceSlug,
  tab,
  topicName,
  trackId,
  view
}) {
  const safeMemberId = personId || memberId
  const spaceBase = spaceSlug && groupSlug ? spaceUrl(groupSlug, spaceSlug) : null

  if (safeMemberId) {
    if (spaceBase) return `${spaceBase}/members/${safeMemberId}`
    return personUrl(safeMemberId, groupSlug)
  } else if (topicName) {
    return topicUrl(topicName, { context, groupSlug, spaceSlug })
  } else if (trackId) {
    return trackUrl(trackId, { context, groupSlug, spaceSlug, tab })
  } else if (fundingRoundId) {
    return fundingRoundUrl(fundingRoundId, { context, groupSlug, spaceSlug, tab })
  } else if (view) {
    if (spaceBase) {
      return `${spaceBase}/${view}${customViewId ? '/' + customViewId : ''}`
    }
    return viewUrl(view, { context, customViewId, defaultUrl, groupSlug })
  } else if (context === SEARCH_CONTEXT_SLUG) {
    // Has to come before groupSlug check because we use groupSlug as a param in searching
    return searchUrl()
  } else if (groupSlug) {
    return spaceBase || groupUrl(groupSlug)
  } else if (context === ALL_GROUPS_CONTEXT_SLUG) {
    return allGroupsUrl()
  } else if (context === PUBLIC_CONTEXT_SLUG) {
    return publicGroupsUrl()
  } else if (context === MY_CONTEXT_SLUG) {
    return myHomeUrl()
  } else if (context === MESSAGES_CONTEXT_SLUG) {
    return messagesUrl()
  } else {
    return defaultUrl
  }
}

export function createUrl (opts = {}, querystringParams = {}) {
  const url = baseUrl(opts) + '/create'

  return addQuerystringToPath(url, querystringParams)
}

// For specific views of a group like 'map', or 'projects'
export function viewUrl (view, { context, groupSlug, defaultUrl, customViewId, spaceSlug }) {
  if (!view) return '/'

  const base = baseUrl({ context, groupSlug, defaultUrl, spaceSlug })

  return `${base}/${view}${customViewId ? '/' + customViewId : ''}`
}

// Group URLS
export function groupUrl (slug, view = '', defaultUrl = allGroupsUrl()) {
  if (slug === 'public') { // TODO: remove this?
    return publicGroupsUrl()
  } else if (slug) {
    return `/groups/${slug}` + (view ? '/' + view : '')
  } else {
    return defaultUrl
  }
}

/** Local space slug portion from a stored space slug (parentSlug-localName). */
export function localSpaceSlug (parentSlug, spaceFullSlug) {
  if (!parentSlug || !spaceFullSlug) return spaceFullSlug || ''
  const prefix = `${parentSlug}-`
  return spaceFullSlug.startsWith(prefix) ? spaceFullSlug.slice(prefix.length) : spaceFullSlug
}

/** Path segment for a GroupView within a group or space (e.g. /chat, /custom/123). */
export function groupViewPath (view) {
  if (!view) return ''
  switch (view.type) {
    case 'post':
      return view.viewPost?.id ? `/post/${view.viewPost.id}` : ''
    case 'member':
      return view.viewUser?.id ? `/members/${view.viewUser.id}` : ''
    case 'custom':
      return `/custom/${view.id}`
    case 'collection':
      return `/collection/${view.id}`
    case 'space-collection':
      return `/space-collection/${view.id}`
    case 'link':
      return null
    case 'manage-round':
      return '/manage-round'
    case 'stream':
      // Legacy view type — GroupView type is now `all`
      return '/all'
    default:
      return view.type ? `/${view.type}` : '/all'
  }
}

/** Normalize a GroupView from a plain object or Bookshelf model. */
function normalizeGroupView (view) {
  if (!view) return null
  if (typeof view.get === 'function') {
    return { type: view.get('type'), id: view.get('id') }
  }
  return view
}

/**
 * Route path suffix stored in groups.home_route for a GroupView
 * (e.g. /stream, /custom/123, /welcome).
 * Shared by backend GroupView.computeHomeRoutePath and frontend optimistic updates.
 */
export function homeRoutePathForView (view) {
  if (!view) return '/all'
  const normalized = normalizeGroupView(view)
  const path = groupViewPath(normalized)
  if (path) return path
  return normalized.type ? `/${normalized.type}` : '/all'
}

/** Base URL for a space under its parent group. Optional viewPath is appended (e.g. /chat). */
export function spaceUrl (parentSlug, localSlug, viewPath = '') {
  if (!parentSlug || !localSlug) return '/'
  const base = `/groups/${parentSlug}/spaces/${localSlug}`
  if (!viewPath) return base
  return `${base}${viewPath.startsWith('/') ? viewPath : `/${viewPath}`}`
}

/** URL for a view inside a space. */
export function spaceGroupViewUrl (parentSlug, spaceGroup, view) {
  if (!parentSlug || !spaceGroup) return groupUrl(parentSlug)
  const local = localSpaceSlug(parentSlug, spaceGroup.slug)
  const path = groupViewPath(view)
  if (path === null) return view?.link || null
  return spaceUrl(parentSlug, local, path)
}

/** Home view path for a space (`groups.home_route`), with fallbacks when the field was omitted. */
export function spaceHomeRoutePath (spaceGroup) {
  if (!spaceGroup) return '/all'
  const homeView = (spaceGroup.groupViews?.items || []).find(view => view.order === 0)
  if (homeView) return homeRoutePathForView(homeView)
  if (spaceGroup.homeRoute) return spaceGroup.homeRoute
  if (spaceGroup.track?.id) return '/track-actions'
  if (spaceGroup.fundingRound?.id) return '/funding-round-submissions'
  return '/all'
}

/** URL for a space's home view. */
export function spaceHomeUrl (parentSlug, spaceGroup) {
  if (!parentSlug || !spaceGroup) return '/'
  const local = localSpaceSlug(parentSlug, spaceGroup.slug)
  return spaceUrl(parentSlug, local, spaceHomeRoutePath(spaceGroup))
}

export function groupDetailUrl (slug, opts = {}, querystringParams = {}) {
  let result = baseUrl(opts)
  result = `${result}/group/${slug}`

  return addQuerystringToPath(result, querystringParams)
}

export function groupInviteUrl (group) {
  return group.invitePath ? origin() + group.invitePath : ''
}

export function groupHomeUrl ({ group, routeParams }) {
  const slug = group?.slug || routeParams?.groupSlug
  const home = (group?.homeRoute || '/all').replace(/^\//, '')
  return groupUrl(slug, home)
}

// Post URLS
export function postUrl (id, opts = {}, querystringParams = {}) {
  const action = get('action', opts)
  // Standalone /groups/:slug/post/:id uses "post" as a path segment, not a stream view name
  const urlOpts = opts.view === 'post' ? { ...opts, view: undefined } : opts
  let result
  if (urlOpts.context === '') {
    result = `/post/${id}`
  } else {
    result = baseUrl(urlOpts)
    result = `${result}/post/${id}`
  }
  if (action) result = `${result}/${action}`

  return addQuerystringToPath(result, querystringParams)
}

export function createPostUrl (opts = {}, querystringParams = {}) {
  const url = baseUrl(opts) + '/create/post'
  return addQuerystringToPath(url, querystringParams)
}

export function editPostUrl (id, opts = {}, querystringParams = {}) {
  return postUrl(id, { ...opts, action: 'edit' }, querystringParams)
}

export function duplicatePostUrl (id, opts = {}) {
  return createPostUrl(opts, { fromPostId: id })
}

// Given a post return the the main way to view the post
// Chats go to the chat room scrolled to the post
// Posts go to the stream with the post opened
export function primaryPostUrl (post, opts = {}, querystringParams = {}) {
  let result = baseUrl(opts)
  const postId = get('id', post) || post
  if (post.type === 'chat') {
    result = `${baseUrl({ ...opts, view: 'chat' })}`
    if (opts.commentId) {
      // commentId in route params causes the post to open when the room loads
      result = `${result}/post/${postId}?commentId=${opts.commentId}`
    } else {
      // postId as querystring highlights the message without forcing it open
      result = `${result}?postId=${postId}`
    }
  } else {
    // Non-chat posts open within the group's home view so there is context.
    // homeRoute is a path like '/all', '/map', or '/chat'.
    // Non-chat posts always use the /post/:id path format (modal overlay) even
    // when the home is a chat view, so you can see the full post and comments
    // (?postId= is reserved for chat-type posts only).
    // If the home is a chat view but the post has no topics (e.g. Zapier-
    // created posts), fall back to the standalone /post/:id URL so the UI
    // can still open the post even though it isn't in any chat room.
    const homeRoute = opts.homeRoute || '/all'
    if (homeRoute === '/chat' || homeRoute.startsWith('/chat/')) {
      // Non-chat post shown in a chat home: open as a modal above the chat
      result = `${result}/chat/post/${postId}`
      if (opts.commentId) result = `${result}?commentId=${opts.commentId}`
    } else {
      result = `${result}${homeRoute}/post/${postId}`
      if (opts.commentId) result = `${result}?commentId=${opts.commentId}`
    }
  }
  return addQuerystringToPath(result, querystringParams)
}

// Messages URLs
export function messagesUrl () {
  return '/messages'
}

export function newMessageUrl () {
  return `${messagesUrl()}/new`
}

export function messageThreadUrl (id) {
  return `${messagesUrl()}/${id}`
}

export function messagePersonUrl (person) {
  // TODO: messageThreadId doesn't seem to be currently ever coming-in from the backend
  const { id: participantId, messageThreadId } = person

  return messageThreadId
    ? messageThreadUrl(messageThreadId)
    : newMessageUrl() + `?participants=${participantId}`
}

// Person URLs
export function currentUserSettingsUrl (view = 'edit-profile') {
  return '/my' + (view ? '/' + view : '')
}

export function personUrl (id, groupSlug) {
  if (!id) return '/'
  const base = baseUrl({ groupSlug })

  return `${base}/members/${id}`
}

// Topics URLs
export function topicsUrl (opts, defaultUrl = allGroupsUrl()) {
  return baseUrl({ ...opts, view: 'topics' }, defaultUrl)
}

export function topicUrl (topicName, opts) {
  return `${topicsUrl(opts)}/${topicName}`
}

export function chatUrl (_chatName, { context, groupSlug, spaceSlug } = {}) {
  return viewUrl('chat', { context, groupSlug, spaceSlug })
}

export function customViewUrl (customViewId, rootPath, { context, groupSlug }) {
  return `${baseUrl({ context, groupSlug })}/custom/${customViewId}`
}

/**
 * URL for a Track's space. Prefer opts.space (or spaceSlug) — legacy
 * /groups/:groupSlug/tracks/:trackId routes are no longer supported.
 */
export function trackUrl (trackId, opts = {}) {
  const { groupSlug, spaceSlug, space, tab } = opts
  const localSlug = spaceSlug || (space?.slug && groupSlug ? localSpaceSlug(groupSlug, space.slug) : null)
  if (groupSlug && localSlug) {
    if (!tab && space) return spaceHomeUrl(groupSlug, space)
    return spaceUrl(groupSlug, localSlug, tab ? `/${tab}` : '')
  }
  if (groupSlug) return groupUrl(groupSlug, 'settings/tracks')
  return '/my/tracks'
}

/**
 * URL for a Funding Round's space. Prefer opts.space (or spaceSlug) — legacy
 * /groups/:groupSlug/funding-rounds/:id routes are no longer supported.
 */
export function fundingRoundUrl (fundingRoundId, opts = {}) {
  const { groupSlug, spaceSlug, space, tab } = opts
  const localSlug = spaceSlug || (space?.slug && groupSlug ? localSpaceSlug(groupSlug, space.slug) : null)
  // Legacy tab name → space view path
  const viewTab = tab === 'submissions' ? 'funding-round-submissions' : tab
  if (groupSlug && localSlug) {
    if (!viewTab && space) return spaceHomeUrl(groupSlug, space)
    return spaceUrl(groupSlug, localSlug, viewTab ? `/${viewTab}` : '')
  }
  if (groupSlug) return groupUrl(groupSlug)
  return '/'
}

/**
 * Generates a URL for an offering details page
 * @param {string} offeringId - The offering ID
 * @param {string} groupSlug - The group slug
 * @returns {string} The offering URL path
 */
export function offeringUrl (offeringId, groupSlug) {
  return `/groups/${groupSlug}/offerings/${offeringId}`
}

// URL utility functions

export function setQuerystringParam (key, value, location) {
  const querystringParams = new URLSearchParams(location.search)
  querystringParams.set(key, value)
  return querystringParams.toString()
}

export function stringifyParams (paramsObj) {
  // The weird query needed to ignore empty arrays but allow for boolean values and numbers
  const filtered = omitBy(x => isEmpty(x) && x !== true && x !== false && !isNumber(x), paramsObj)
  const params = new URLSearchParams()
  Object.entries(filtered).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(v => params.append(key, v))
    } else if (value !== undefined && value !== null) {
      params.append(key, value)
    }
  })
  return params.toString()
}

export function addQuerystringToPath (path, querystringParams) {
  const queryString = stringifyParams(querystringParams)
  return `${path}${queryString ? '?' + queryString : ''}`
}

export function removeCreateEditModalFromUrl (url) {
  const matchForCreateRegex = '/create/(post|track)/*'
  const matchForEditRegex = `/post/${HYLO_ID_MATCH}(/.*)?`
  return url.replace(new RegExp(matchForCreateRegex), '')
    .replace(new RegExp(matchForEditRegex), '')
}

/**
 * Drops compose-modal-only query params so the underlying route (e.g. chat room)
 * does not keep `newPostType` / draft resume params after the modal closes.
 * @param {string} url Path with optional search and hash (relative to origin is OK)
 * @returns {string}
 */
export function stripComposeModalQueryParams (url) {
  if (!url || typeof url !== 'string') return url
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    const u = new URL(url, base)
    u.searchParams.delete('newPostType')
    u.searchParams.delete('eventDate')
    u.searchParams.delete('sourceDraftId')
    u.searchParams.delete('closePath')
    return `${u.pathname}${u.search}${u.hash}`
  } catch {
    return url
  }
}

export function removePostFromUrl (url) {
  const matchForReplaceRegex = `/post/${POST_ID_MATCH}(/.*)?`
  return url.replace(new RegExp(matchForReplaceRegex), '')
}

export function removeGroupFromUrl (url) {
  const matchForReplaceRegex = `/group/${GROUP_SLUG_MATCH}`
  return url.replace(new RegExp(matchForReplaceRegex), '')
}

export function gotoExternalUrl (url) {
  return window.open(url, null, 'noopener,noreferrer')
}

export const origin = () =>
  typeof window !== 'undefined' ? window.location.origin : process.env.VITE_HOST

// Utility path functions

export function isPublicPath (path) {
  return (path.startsWith('/public'))
}

export function isMapView (path) {
  return (path.includes('/map/'))
}

export function isGroupsView (path) {
  return (path.includes('/groups/'))
}

export const getTrackIdFromPath = (path) => {
  if (!path) return null
  const match = path.match(/tracks\/(\d+)/)
  return match ? match[1] : null
}

export const getGroupslugFromPath = (path) => {
  if (!path) return null
  const match = path.match(/\/groups\/([^/]+)(?:\/|$)/)
  return match ? match[1] : null
}

export function topicPath (topicName, groupSlug) {
  if (groupSlug && ![ALL_GROUPS_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG].includes(groupSlug)) {
    return `/groups/${groupSlug}/topics/${topicName}`
  } else {
    return `/${ALL_GROUPS_CONTEXT_SLUG}/topics/${topicName}`
  }
}

export function mentionPath (memberId, groupSlug) {
  if (groupSlug && ![ALL_GROUPS_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG].includes(groupSlug)) {
    return `/groups/${groupSlug}/members/${memberId}`
  } else {
    return `/${ALL_GROUPS_CONTEXT_SLUG}/members/${memberId}`
  }
}
