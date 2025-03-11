// NOTE: Entire file tracks `hylo-evo/util/navigation.js`
import { host } from 'config'
import { get, isEmpty, isNumber, omitBy } from 'lodash/fp'
import qs from 'query-string'
import { PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG } from '@hylo/shared'
import { isContextGroupSlug } from '@hylo/presenters/GroupPresenter'

export const HYLO_ID_MATCH = '\\d+'
export const POST_ID_MATCH = HYLO_ID_MATCH
export const OPTIONAL_POST_MATCH = `:detail(post)?/:postId(${POST_ID_MATCH})?/:action(new|edit)?`
export const OPTIONAL_NEW_POST_MATCH = ':detail(post)?/:action(new)?' // TODO: need this?
export const POST_DETAIL_MATCH = `:detail(post)/:postId(${POST_ID_MATCH})/:action(edit)?`

export const REQUIRED_EDIT_POST_MATCH = `:detail(post)/:postId(${POST_ID_MATCH})/:action(edit)`

export const GROUP_DETAIL_MATCH = ':detail(group)/:detailGroupSlug'
export const OPTIONAL_GROUP_MATCH = ':detail(group)?/(:detailGroupSlug)?'

// Fundamental URL paths

export function publicContextUrl () {
  return '/public'
}

export function myContextUrl () {
  return '/my'
}

export function baseUrl ({
  context,
  customViewId,
  defaultUrl = myContextUrl(),
  groupSlug,
  memberId, personId, // TODO: switch to one of these?
  topicName,
  view
}) {
  const safeMemberId = personId || memberId

  if (safeMemberId) {
    return personUrl(safeMemberId, groupSlug)
  } else if (topicName) {
    return topicUrl(topicName, { context, groupSlug })
  } else if (view) {
    return viewUrl(view, { context, customViewId, defaultUrl, groupSlug })
  } else if (groupSlug) {
    return groupUrl(groupSlug)
  } else if (context === PUBLIC_CONTEXT_SLUG) {
    return publicContextUrl()
  } else if (context === MY_CONTEXT_SLUG) {
    return myContextUrl()
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
export function groupUrl (slug, view = '', defaultUrl = myContextUrl()) {
  if (slug === PUBLIC_CONTEXT_SLUG) { // TODO: remove this?
    return publicContextUrl()
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

export function commentUrl (postId, commentId, opts = {}, querystringParams = {}) {
  return `${postUrl(postId, opts, querystringParams)}#comment_${commentId}`
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
export function currentUserSettingsUrl (view = '') {
  return '/settings' + (view ? '/' + view : '')
}

export function personUrl (id, groupSlug) {
  if (!id) return '/'
  const base = baseUrl({ groupSlug })

  return `${base}/members/${id}`
}

// Topics and Chat URLs
export function topicsUrl (opts, defaultUrl = myContextUrl()) {
  return baseUrl({ ...opts, view: 'topics' }, defaultUrl)
}

export function topicUrl (topicName, opts) {
  return `${topicsUrl(opts)}/${topicName}`
}

export function chatUrl (chatName, { context, groupSlug }) {
  return `${baseUrl({ context, groupSlug })}/chat/${chatName}`
}

// CustomView urls

export function customViewUrl (customViewId, rootPath, opts) {
  return `${rootPath}/custom/${customViewId}`
}

// Widget urls

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
    url = customViewUrl(widget.customView.id, groupUrl(groupSlug))
  }

  return url
}

// URL utility functions

export function addQuerystringToPath (path, querystringParams) {
  // The weird query needed to ignore empty arrays but allow for boolean values and numbers
  querystringParams = omitBy(x => isEmpty(x) && x !== true && !isNumber(x), querystringParams)
  return `${path}${!isEmpty(querystringParams) ? '?' + qs.stringify(querystringParams) : ''}`
}

export function removePostFromUrl (url) {
  const matchForReplaceRegex = `/post/${POST_ID_MATCH}`
  return url.replace(new RegExp(matchForReplaceRegex), '')
}

export function removeGroupFromUrl (url) {
  const matchForReplaceRegex = '/group/([^/]*)'
  return url.replace(new RegExp(matchForReplaceRegex), '')
}

export const origin = () =>
  typeof window !== 'undefined' ? window.location.origin : host

// Utility path functions

export function isPublicPath (path) {
  return (path.startsWith('/public'))
}

export function ensureHttpsForPath (path) {
  // Check if path is a valid URI path
  // Regex matches paths that start with a domain name pattern
  // e.g. example.com, sub.example.com, example.co.uk etc
  const validPathRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)*\.[a-zA-Z]{2,}(\/.*)?$/

  if (!path || typeof path !== 'string') return null

  // Remove any existing protocol
  const cleanPath = path.replace(/^https?:\/\//, '')

  if (!validPathRegex.test(cleanPath)) return null

  return `https://${cleanPath}`
}

