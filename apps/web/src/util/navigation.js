import { get, isEmpty, isNumber, omitBy } from 'lodash/fp'
import qs from 'query-string'
import { host } from 'config/index'
import { isContextGroupSlug } from '@hylo/presenters/GroupPresenter'
import { ALL_GROUPS_CONTEXT_SLUG, MY_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG } from '@hylo/shared'

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

export function baseUrl ({
  context,
  customViewId,
  defaultUrl = allGroupsUrl(),
  groupSlug,
  memberId, personId, // TODO: switch to one of these?
  topicName,
  view
}) {
  const safeMemberId = personId || memberId

  if (safeMemberId) {
    return personUrl(safeMemberId, groupSlug)
  } else if (view === 'chat' && topicName) {
    return chatUrl(topicName, { context, groupSlug })
  } else if (topicName) {
    return topicUrl(topicName, { context, groupSlug })
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

// Post URLS
export function postUrl (id, opts = {}, querystringParams = {}) {
  const action = get('action', opts)
  let result = baseUrl(opts)
  result = `${result}/post/${id}`
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

export function customViewUrl (customViewId, rootPath, opts) {
  return `${rootPath}/custom/${customViewId}`
}

export function widgetUrl ({ widget, rootPath, groupSlug: providedSlug, context = 'group' }) {
  if (!widget) return null

  const groupSlug = isContextGroupSlug(providedSlug) ? null : providedSlug
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
    url = customViewUrl(widget.customView.id, rootPath, { groupSlug })
  }

  return url
}

// URL utility functions

export function setQuerystringParam (key, value, location) {
  const querystringParams = new URLSearchParams(location.search)
  querystringParams.set(key, value)
  return querystringParams.toString()
}

export function addQuerystringToPath (path, querystringParams) {
  // The weird query needed to ignore empty arrays but allow for boolean values and numbers
  querystringParams = omitBy(x => isEmpty(x) && x !== true && !isNumber(x), querystringParams)
  return `${path}${!isEmpty(querystringParams) ? '?' + qs.stringify(querystringParams) : ''}`
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
  typeof window !== 'undefined' ? window.location.origin : host

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
