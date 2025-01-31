// NOTE: Entire file tracks `hylo-evo/util/navigation.js`
import { host } from 'config'
import { get, isEmpty, isNumber, omitBy } from 'lodash/fp'
import qs from 'query-string'
import { ALL_GROUPS_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG } from '@hylo/shared'

export const HYLO_ID_MATCH = '\\d+'
export const POST_ID_MATCH = HYLO_ID_MATCH
export const OPTIONAL_POST_MATCH = `:detail(post)?/:postId(${POST_ID_MATCH})?/:action(new|edit)?`
export const OPTIONAL_NEW_POST_MATCH = ':detail(post)?/:action(new)?' // TODO: need this?
export const POST_DETAIL_MATCH = `:detail(post)/:postId(${POST_ID_MATCH})/:action(edit)?`

export const REQUIRED_EDIT_POST_MATCH = `:detail(post)/:postId(${POST_ID_MATCH})/:action(edit)`

export const GROUP_DETAIL_MATCH = ':detail(group)/:detailGroupSlug'
export const OPTIONAL_GROUP_MATCH = ':detail(group)?/(:detailGroupSlug)?'

// Fundamental URL paths

export function allGroupsUrl () {
  return '/all'
}

export function publicGroupsUrl () {
  return '/public'
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
  if (slug === PUBLIC_CONTEXT_SLUG) { // TODO: remove this?
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

// Topics URLs
export function topicsUrl (opts, defaultUrl = allGroupsUrl()) {
  return baseUrl({ ...opts, view: 'topics' }, defaultUrl)
}

export function topicUrl (topicName, opts) {
  return `${topicsUrl(opts)}/${topicName}`
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

export function gotoExternalUrl (url) {
  return window.open(url, null, 'noopener,noreferrer')
}

export const origin = () =>
  typeof window !== 'undefined' ? window.location.origin : host

// Utility path functions

export function isPublicPath (path) {
  return (path.startsWith('/public'))
}
