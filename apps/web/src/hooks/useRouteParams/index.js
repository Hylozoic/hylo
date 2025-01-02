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
  const pathParts = location.pathname.split('/')

  // if context is not set, then look for the first part of the url to set as the context
  if (!params.context) {
    const firstPart = pathParts[1]
    if (['groups', 'all', 'public', 'my', 'welcome'].includes(firstPart)) {
      params.context = firstPart
    } else {
      params.context = 'all'
    }
  }

  // if view is not set, then set it
  if (!params.view) {
    if (params.context === 'groups') {
      // Correctly track the view for groups context
      params.view = !['post', 'group', 'create'].includes(pathParts[3]) ? pathParts[3] : 'stream'
    } else {
      params.view = pathParts[2]
    }
  }

  if (params.view === 'members') {
    params.memberId = params.context === 'groups' ? pathParts[4] : pathParts[3]
  }

  // Mix query params and path params into one object, query params take precedence
  return useMemo(() => {
    return {
      ...queryString.parse(location.search), // Convert string to object
      ...params
    }
  }, [params, location])
}
