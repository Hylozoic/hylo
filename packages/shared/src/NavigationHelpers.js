import { get, isEmpty, isNumber, omitBy } from 'lodash/fp'

export const HYLO_ID_MATCH = '\\d+'
export const POST_ID_MATCH = HYLO_ID_MATCH
const GROUP_SLUG_MATCH = '[^\\\\]+'
// TODO: do this validation elsewhere?
export const OPTIONAL_POST_MATCH = ':detail(post)?/:postId?/:action(new|edit)?'
export const OPTIONAL_NEW_POST_MATCH = ':detail(post)?/:action(new)?' // TODO: need this?
export const POST_DETAIL_MATCH = 'post/:postId/*'

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
  } else if (topicName) {
    return topicUrl(topicName, { context, groupSlug })
  } else if (view) {
    return viewUrl(view, { context, customViewId, defaultUrl, groupSlug })
  } else if (groupSlug) {
    return groupUrl(groupSlug)
  } else if (context === 'all') {
    return allGroupsUrl()
  } else if (context === 'public') {
    return publicGroupsUrl()
  } else if (context === 'my') {
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

export function postCommentUrl ({ postId, commentId, ...opts }, querystringParams = {}) {
  return `${postUrl(postId, opts, querystringParams)}/comments/${commentId}`
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
  // TODO: redesign - changed from topics to chats, is that correct now always?
  // do we need also or otherwise legacy route redirect support for topics?
  return baseUrl({ ...opts, view: 'chats' }, defaultUrl)
}

export function topicUrl (topicName, opts) {
  return `${topicsUrl(opts)}/${topicName}`
}

export function chatUrl (chatName, opts) {
  return `${topicsUrl(opts)}/${chatName}`
}

export function customViewUrl (customViewId, rootPath, opts) {
  return `${rootPath}/custom/${customViewId}`
}

export function widgetUrl ({ widget, rootPath, groupSlug, context = 'groups' }) {
  let url = null

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
    url = postUrl(widget.viewPost.id)
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
  return `${path}${!isEmpty(querystringParams) ? '?' + stringify(querystringParams) : ''}`
}

export function removePostFromUrl (url) {
  const matchForReplaceRegex = `/post/${POST_ID_MATCH}`
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

function stringify(object, options = {}) {
  if (!object) return '';

  // Default options
  const {
    arrayFormat = 'none',
    skipNull = false,
    skipEmptyString = false,
    encode = true,
    strict = true
  } = options;

  // Helper function to encode values
  function encodeValue(value) {
    if (!encode) return value;
    const encoded = encodeURIComponent(value);
    return strict 
      ? encoded.replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
      : encoded;
  }

  function formatArray(key, array) {
    if (array.length === 0) return '';

    switch (arrayFormat) {
      case 'index':
        return array.map((value, index) => 
          `${encodeValue(key)}[${index}]=${encodeValue(value)}`).join('&');
      
      case 'bracket':
        return array.map(value => 
          `${encodeValue(key)}[]=${encodeValue(value)}`).join('&');
      
      case 'comma':
        return `${encodeValue(key)}=${array.map(encodeValue).join(',')}`;
      
      default: // 'none'
        return array.map(value => 
          `${encodeValue(key)}=${encodeValue(value)}`).join('&');
    }
  }

  // Convert object to query string
  const parts = [];
  
  Object.keys(object)
    .sort() // Sort keys alphabetically
    .forEach(key => {
      const value = object[key];
      
      // Skip null/undefined values if skipNull is true
      if (skipNull && (value === null || value === undefined)) return;
      
      // Skip empty strings if skipEmptyString is true
      if (skipEmptyString && value === '') return;

      // Handle different value types
      if (Array.isArray(value)) {
        const arrayString = formatArray(key, value);
        if (arrayString) parts.push(arrayString);
      } else if (value !== undefined) {
        if (value === null) {
          parts.push(encodeValue(key));
        } else {
          parts.push(`${encodeValue(key)}=${encodeValue(value.toString())}`);
        }
      }
    });

  return parts.join('&');
}
