import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { PINNABLE_VIEW_TYPES } from '@hylo/shared'
import useRouteParams from 'hooks/useRouteParams'
import useGroupViews from 'hooks/useGroupViews'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import getGroupForSlug from 'store/selectors/getGroupForSlug'

/**
 * The GroupView the current route can pin posts to, or null when the route is
 * not a pinnable view (My, Public, map, welcome, search, etc.).
 */
export default function useCurrentPinnableView () {
  const routeParams = useRouteParams()
  const groupSlug = useEffectiveGroupSlug()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const groupViews = useGroupViews(group)
  const { view, customViewId } = routeParams

  return useMemo(() => {
    if (customViewId) {
      const found = (groupViews || []).find(gv => String(gv.id) === String(customViewId))
      if (found && PINNABLE_VIEW_TYPES.includes(found.type)) return found
      return null
    }
    if (!PINNABLE_VIEW_TYPES.includes(view)) return null
    return (groupViews || []).find(gv => gv.type === view) || null
  }, [groupViews, view, customViewId])
}
