import { get } from 'lodash/fp'
import queryString from 'query-string'
import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useRouteParams from 'hooks/useRouteParams'
import { postUrl } from '@hylo/navigation'

export default function useViewPostDetails () {
  const routeParams = useRouteParams()
  const location = useLocation()
  const querystringParams = queryString.parse(location.search)
  const navigate = useNavigate()

  // opts.focusComment rides navigation state, not the querystring — this hook
  // spreads current query params into future post URLs, so a param would
  // persist and re-trigger on later opens
  const viewPostDetails = useCallback((post, opts = {}) => {
    const postId = get('id', post) || post
    navigate(postUrl(postId, routeParams, querystringParams), opts.focusComment ? { state: { focusComment: true } } : undefined)
  }, [routeParams, querystringParams])

  return viewPostDetails
}
