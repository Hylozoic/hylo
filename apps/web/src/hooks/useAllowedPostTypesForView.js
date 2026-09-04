import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { COMMON_VIEWS } from 'store/models/GroupView'
import useRouteParams from 'hooks/useRouteParams'
import orm from 'store/models'

const getGroupView = ormCreateSelector(
  orm,
  (_, viewId) => viewId,
  (session, id) => session.GroupView.safeGet({ id })
)

/**
 * Returns the post types allowed when creating from the current view, or null for all types.
 * Typed system views (requests-and-offers, projects, etc.), custom views, and calendar mode restrict options.
 */
export default function useAllowedPostTypesForView () {
  const routeParams = useRouteParams()
  const { view, customViewId, v: viewMode } = routeParams
  const groupView = useSelector(state => customViewId ? getGroupView(state, customViewId) : null)
  const systemView = COMMON_VIEWS[view]
  const viewPostTypes = groupView?.settings?.postTypes

  return useMemo(() => {
    if (viewMode === 'calendar') return ['event']
    if (viewPostTypes?.length) return viewPostTypes
    if (systemView?.postTypes?.length) return systemView.postTypes
    return null
  }, [viewPostTypes, systemView, viewMode])
}
