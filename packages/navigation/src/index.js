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

export const isStaticContext = contextOrSlug =>
  [PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG].includes(contextOrSlug?.slug || contextOrSlug)

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

// TODO: have to have this here because otherwise the presenters package loads navigation package and visa versa which is a circular dependency
export function findHomeWidget (group) {
  if (!group?.contextWidgets) {
    throw new Error('Group has no contextWidgets')
  }
  const homeWidget = group.contextWidgets.items.find(w => w.type === 'home')
  return group.contextWidgets.items.find(w => w.parentId === homeWidget.id)
}

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

export function baseUrl ({
  context,
  customViewId,
  defaultUrl = allGroupsUrl(),
  fundingRoundId,
  groupSlug,
  memberId, personId, // TODO: switch to one of these?
  tab,
  topicName,
  trackId,
  view
}) {
  const safeMemberId = personId || memberId

  if (safeMemberId) {
    return personUrl(safeMemberId, groupSlug)
  } else if (view === 'chat' && topicName) {
    return chatUrl(topicName, { context, groupSlug })
  } else if (topicName) {
    return topicUrl(topicName, { context, groupSlug })
  } else if (trackId) {
    return trackUrl(trackId, { context, groupSlug, tab })
  } else if (fundingRoundId) {
    return fundingRoundUrl(fundingRoundId, { context, groupSlug })
  } else if (view) {
    return viewUrl(view, { context, customViewId, defaultUrl, groupSlug })
  } else if (groupSlug) {
    return groupUrl(groupSlug)
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

export function createGroupUrl (opts) {
  return baseUrl(opts) + '/create/group'
}

export function createTrackUrl (opts) {
  return baseUrl(opts) + '/create/track'
}

// For specific views of a group like 'map', or 'projects'
export function viewUrl (view, { context, groupSlug, defaultUrl, customViewId }) {
  if (!view) return '/'

  const base = baseUrl({ context, groupSlug, defaultUrl })

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

export function groupDetailUrl (slug, opts = {}, querystringParams = {}) {
  let result = baseUrl(opts)
  result = `${result}/group/${slug}`

  return addQuerystringToPath(result, querystringParams)
}

export function groupInviteUrl (group) {
  return group.invitePath ? origin() + group.invitePath : ''
}

export function groupHomeUrl ({ group, routeParams }) {
  return widgetUrl({ ...routeParams, widget: findHomeWidget(group) })
}

// Post URLS
export function postUrl (id, opts = {}, querystringParams = {}) {
  const action = get('action', opts)
  let result
  if (opts.context === '') {
    result = `/post/${id}`
  } else {
    result = baseUrl(opts)
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
    // If topicName passed in we are opening the post from a specific chat room, otherwise if a chat then always open its first topic chat room
    const topicName = post.topics[0].name
    if (opts.commentId) {
      // When there is a commentId we pass the postId in the route params so that the post is opened when the room is loaded
      result = `${result}/chat/${topicName}/post/${postId}?commentId=${opts.commentId}`
    } else {
      // When there is no commentId, we pass the postId in the querystring so that the post is highlighted but not opened when the room is loaded
      result = `${result}/chat/${topicName}?postId=${postId}`
    }
  } else {
    result = `${result}/post/${postId}`
    if (opts.commentId) {
      result = `${result}?commentId=${opts.commentId}`
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

export function chatUrl (chatName, { context, groupSlug }) {
  return `${baseUrl({ context, groupSlug })}/chat/${chatName}`
}

export function customViewUrl (customViewId, rootPath, { context, groupSlug }) {
  return `${baseUrl({ context, groupSlug })}/custom/${customViewId}`
}

export function widgetUrl ({ widget, rootPath, groupSlug: providedSlug, context = 'group' }) {
  if (!widget) return null

  const groupSlug = isStaticContext(providedSlug) ? null : providedSlug
  let url = ''
  if (widget.url) return widget.url
  if (widget.view === 'about') {
    url = groupDetailUrl(groupSlug, { rootPath, groupSlug, context })
  } else if (widget.view) {
    url = viewUrl(widget.view, { groupSlug, context: widget.context || context })
  } else if (widget.viewGroup) {
    url = groupUrl(widget.viewGroup.slug)
  } else if (widget.viewUser) {
    url = personUrl(widget.viewUser.id, groupSlug)
  } else if (widget.viewPost) {
    url = postUrl(widget.viewPost.id, { groupSlug, context })
  } else if (widget.viewChat) {
    url = chatUrl(widget.viewChat.name, { rootPath, groupSlug, context })
  } else if (widget.customView) {
    url = customViewUrl(widget.customView.id, rootPath, { context, groupSlug })
  } else if (widget.viewTrack) {
    url = trackUrl(widget.viewTrack.id, { context, groupSlug })
  } else if (widget.viewFundingRound) {
    url = fundingRoundUrl(widget.viewFundingRound.id, { context, groupSlug })
  }

  return url
}

export function trackUrl (trackId, opts) {
  return baseUrl({ ...opts, context: 'group', view: 'tracks' }) + `/${trackId}` + (opts.tab ? `/${opts.tab}` : '')
}

export function fundingRoundUrl (fundingRoundId, opts) {
  return baseUrl({ ...opts, context: 'group', view: 'funding-rounds' }) + `/${fundingRoundId}`
}

// URL utility functions

export function setQuerystringParam (key, value, location) {
  const querystringParams = new URLSearchParams(location.search)
  querystringParams.set(key, value)
  return querystringParams.toString()
}

export function stringifyParams (paramsObj) {
  // The weird query needed to ignore empty arrays but allow for boolean values and numbers
  const filtered = omitBy(x => isEmpty(x) && x !== true && !isNumber(x), paramsObj)
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
  const matchForEditTrackRegex = `/tracks/${HYLO_ID_MATCH}(/.*)?`
  return url.replace(new RegExp(matchForCreateRegex), '')
    .replace(new RegExp(matchForEditRegex), '')
    .replace(new RegExp(matchForEditTrackRegex), (match) => {
      // Split the match into parts so we only remove the "edit" part of the url
      const parts = match.split('/')
      return parts.slice(0, 3).join('/') // Keep '/tracks/{id}'
    })
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
