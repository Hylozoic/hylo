import { useMemo } from 'react'
import {
  useParams,
  useLocation
} from 'react-router-dom'
import queryString from 'query-string'

// Used to overcome React Router 6's inability to have named URL paramaters that are also validated
// This all feels super hacky, but it works for now
export default function useRouteParams () {
  const params = useParams()
  const location = useLocation()

  // Mix query params and path params into one object, query params take precedence
  return useMemo(() => {
    const pathParts = location.pathname.split('/')

    // if context is not set, then look for the first part of the url to set as the context
    if (!params.context) {
      const firstPart = pathParts[1]
      if (['groups', 'all', 'public', 'my', 'welcome', 'messages', 'search'].includes(firstPart)) {
        params.context = firstPart
      } else if (['post'].includes(firstPart)) {
        // Special case of hylo.com/post/postId
        params.context = ''
        params.view = 'post'
        params.postId = pathParts[2]
      } else {
        params.context = 'all'
      }
    }

    // if view is not set, then set it
    if (!params.view) {
      // Standalone post URL (e.g. /groups/:slug/post/:postId) uses "post" as a path segment, not a stream view name
      if (params.context === 'groups') {
        const isGroupPostDetail = pathParts[3] === 'post' && pathParts[4] && /^\d+$/.test(pathParts[4])
        if (isGroupPostDetail) {
          params.view = 'post'
        } else if (!['create', 'post'].includes(pathParts[3])) {
          params.view = pathParts[3]
        } else {
          params.view = ''
        }
      } else {
        const isContextPostDetail = ['all', 'public', 'my'].includes(params.context) &&
          pathParts[2] === 'post' &&
          pathParts[3] &&
          /^\d+$/.test(pathParts[3])
        if (isContextPostDetail) {
          params.view = 'post'
        } else if (!['create', 'post'].includes(pathParts[2])) {
          params.view = pathParts[2]
        } else {
          params.view = ''
        }
      }
    }

    // Set groupSlug
    if (params.context === 'groups') {
      params.groupSlug = pathParts[2]
    }

    // Set memberId
    if (params.view === 'members') {
      params.memberId = params.context === 'groups' ? pathParts[4] : pathParts[3]
    }

    // Set chat topicName
    if (params.view === 'chat' || params.view === 'topic') {
      // XXX: this should only ever be in a group
      params.topicName = pathParts[4]
    }

    // Set trackId
    if (params.view === 'tracks') {
      params.trackId = pathParts[4]
      params.tab = pathParts[5]
    }

    // Set fundingRoundId
    if (params.view === 'funding-rounds') {
      params.fundingRoundId = pathParts[4]
      params.tab = pathParts[5]
    }

    // If I'm in the group settings then I want the view to include the specific settings tab
    if (params.view === 'settings') {
      params.view = `${params.view}/${pathParts[4]}`
    }

    return {
      ...queryString.parse(location.search), // Convert string to object
      ...params
    }
  }, [params, location])
}
