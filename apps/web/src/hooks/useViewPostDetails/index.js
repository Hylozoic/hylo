import { get } from 'lodash/fp'
import queryString from 'query-string'
import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useRouteParams from 'hooks/useRouteParams'
import { postUrl } from 'util/navigation'

export default function useViewPostDetails () {
  const routeParams = useRouteParams()
  const location = useLocation()
  const querystringParams = queryString.parse(location.search)
  const navigate = useNavigate()

  const viewPostDetails = useCallback((post) => {
    const postId = get('id', post) || post
    navigate(postUrl(postId, routeParams, querystringParams))
  }, [routeParams, querystringParams])

  return viewPostDetails
}
