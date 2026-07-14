import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { COMMON_VIEWS } from '@hylo/presenters/ContextWidgetPresenter'
import useRouteParams from 'hooks/useRouteParams'
import orm from 'store/models'

const getCustomView = ormCreateSelector(
  orm,
  (_, customViewId) => customViewId,
  (session, id) => session.CustomView.safeGet({ id })
)

/**
 * Returns the post types allowed when creating from the current view, or null for all types.
 * Typed system views (requests-and-offers, projects, etc.), stream custom views, and calendar mode restrict options.
 */
export default function useAllowedPostTypesForView () {
  const routeParams = useRouteParams()
  const { view, customViewId, v: viewMode } = routeParams
  const customView = useSelector(state => customViewId ? getCustomView(state, customViewId) : null)
  const systemView = COMMON_VIEWS[view]

  return useMemo(() => {
    if (viewMode === 'calendar') return ['event']
    if (customView?.type === 'stream' && customView.postTypes?.length) return customView.postTypes
    if (systemView?.postTypes?.length) return systemView.postTypes
    return null
  }, [customView, systemView, viewMode])
}
