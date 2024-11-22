import { useMemo } from 'react'
import {
  useParams,
  useLocation
} from 'react-router-dom'
import queryString from 'query-string'

// Used to overcome React Router 6's inability to have named URL paramaters that are also validated
export default function useRouteParams () {
  const params = useParams()
  const location = useLocation()

  // if context is not set, then look for the first part of the url to set as the context
  if (!params.context) {
    const pathParts = location.pathname.split('/')
    const firstPart = pathParts[1]
    if (['groups', 'all', 'public', 'my', 'welcome'].includes(firstPart)) {
      params.context = firstPart || 'all'
    }
  }

  // if view is not set, then set it
  if (!params.view) {
    const pathParts = location.pathname.split('/')
    params.view = params.context === 'groups' ? pathParts[3] : pathParts[2]
  }

  // Mix query params and path params into one object, query params take precedence
  return useMemo(() => {
    return {
      ...queryString.parse(location.search), // Convert string to object
      ...params
    }
  }, [params, location])
}
