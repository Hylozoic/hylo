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
  return baseUrl({ ...opts, view: 'topics' }, defaultUrl)
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

export function widgetUrl ({ widget, rootPath, groupSlug, context = 'group' }) {
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

export function widgetToMobileNavObject ({ widget, destinationGroup }) {
  if (!widget) return null

  // Base navigation object for Home Tab screens
  const homeTabNav = ['Home Tab']

  // Handle different widget types and views
  if (widget.view === 'about') {
    return [...homeTabNav, {
      screen: 'Group Explore',
      params: { groupSlug: destinationGroup?.slug }
    }]
  }

  if (widget.view === 'stream') {
    return [...homeTabNav, {
      screen: 'Stream',
      params: { groupSlug: destinationGroup?.slug }
    }]
  }

  if (widget.view === 'map') {
    return [...homeTabNav, {
      screen: 'Map',
      params: { groupSlug: destinationGroup?.slug }
    }]
  }

  if (widget.view === 'members') {
    return [...homeTabNav, {
      screen: 'Members',
      params: { groupSlug: destinationGroup?.slug }
    }]
  }

  if (widget.viewChat) {
    return [...homeTabNav, {
      screen: 'Chat',
      params: { 
        topicName: widget.viewChat.name,
        groupSlug: destinationGroup?.slug 
      }
    }]
  }

  if (widget.viewPost) {
    return [...homeTabNav, {
      screen: 'Post Details',
      params: { id: widget.viewPost.id }
    }]
  }

  if (widget.viewUser) {
    return [...homeTabNav, {
      screen: 'Member',
      params: { 
        id: widget.viewUser.id,
        groupSlug: destinationGroup?.slug 
      }
    }]
  }

  if (widget.viewGroup) {
    return [...homeTabNav, {
      screen: 'Group Navigation',
      params: { groupSlug: widget.viewGroup.slug }
    }]
  }

  if (widget.customView) {
    return [...homeTabNav, {
      screen: 'Stream',
      params: { 
        customViewId: widget.customView.id,
        groupSlug: destinationGroup?.slug
      }
    }]
  }

  // TOOD redesign: need to add ask-and-offer screen to this
  switch (widget.view) {
    case 'projects':
      return [...homeTabNav, {
        screen: 'Projects',
        params: { groupSlug: destinationGroup?.slug }
      }]
    case 'events':
      return [...homeTabNav, {
        screen: 'Events',
        params: { groupSlug: destinationGroup?.slug }
      }]
    case 'decisions':
    case 'proposals':
      return [...homeTabNav, {
        screen: 'Decisions',
        params: { groupSlug: destinationGroup?.slug }
      }]
    case 'all-views':
      return [...homeTabNav, {
        screen: 'All Views',
        params: { groupSlug: destinationGroup?.slug }
      }]
    // My context views
    case 'posts':
      return [...homeTabNav, {
        screen: 'My Posts',
        params: { context: 'my' }
      }]
    case 'interactions':
      return [...homeTabNav, {
        screen: 'Interactions',
        params: { context: 'my' }
      }]
    case 'mentions':
      return [...homeTabNav, {
        screen: 'Mentions',
        params: { context: 'my' }
      }]
    case 'announcements':
      return [...homeTabNav, {
        screen: 'Announcements',
        params: { context: 'my' }
      }]
    case 'edit-profile':
      return [...homeTabNav, {
        screen: 'Edit Profile',
        params: { context: 'my' }
      }]
    case 'groups':
      return [...homeTabNav, {
        screen: widget.context === 'my' ? 'My Groups' : 'Groups',
        params: { context: widget.context || 'group', groupSlug: destinationGroup?.slug }
      }]
    case 'invitations':
      return [...homeTabNav, { // TODO redesign: ensure this goes to the users invitations
        screen: 'My Invitations',
        params: { context: 'my' }
      }]
    case 'notifications':
      return [...homeTabNav, { // TODO redesign: ensure this goes to the users Notifications Settings
        screen: 'My Notifications',
        params: { context: 'my' }
      }]
    case 'locale':
      return [...homeTabNav, { // TODO redesign: ensure this opens a language selector action menu
        screen: 'Language Settings',
        params: { context: 'my' }
      }]
    case 'account':
      return [...homeTabNav, { // TODO redesign: ensure this goes to the users Account Settings
        screen: 'Account Settings',
        params: { context: 'my' }
      }]
    case 'saved-searches':
      return [...homeTabNav, {
        screen: 'Saved Searches',
        params: { context: 'my' }
      }]
  }

  return null
}