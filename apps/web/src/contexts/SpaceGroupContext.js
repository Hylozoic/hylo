import { createContext, useContext, useMemo } from 'react'
import { useSelector } from 'react-redux'
import useRouteParams from 'hooks/useRouteParams'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getGroupViews } from 'store/selectors/getGroupViews'
import { localSpaceSlug } from '@hylo/navigation'

/** When viewing a space under /groups/:parentSlug/spaces/:spaceSlug, holds the space group's full slug. */
export const SpaceGroupSlugContext = createContext(null)

/** Route opts for URL builders — includes space path when viewing a space. */
export function useGroupRouteOpts () {
  const spaceGroupSlug = useContext(SpaceGroupSlugContext)
  const routeParams = useRouteParams()
  const parentGroupSlug = routeParams.groupSlug
  const spaceSlug = routeParams.spaceSlug

  // Fallback for components rendered outside SpaceContent's provider (e.g. CreateModal):
  // resolve the space's full slug from the parent group's menu views or More Spaces list
  const needsLookup = !spaceGroupSlug && !!spaceSlug && !!parentGroupSlug
  const parentGroup = useSelector(state => needsLookup ? getGroupForSlug(state, parentGroupSlug) : null)
  const groupViews = useSelector(state => needsLookup && parentGroup ? getGroupViews(state, parentGroup) : null)
  const resolvedSpaceGroupSlug = useMemo(() => {
    if (spaceGroupSlug) return spaceGroupSlug
    if (!needsLookup || !parentGroup) return null

    const menuSpace = (groupViews || []).find(v =>
      v.type === 'space' &&
      localSpaceSlug(parentGroupSlug, v.linkedGroup?.slug) === spaceSlug
    )
    if (menuSpace?.linkedGroup?.slug) return menuSpace.linkedGroup.slug

    const offMenuSpace = (parentGroup.spaces?.items || []).find(space =>
      localSpaceSlug(parentGroupSlug, space.slug) === spaceSlug
    )
    return offMenuSpace?.slug || null
  }, [spaceGroupSlug, needsLookup, parentGroup, groupViews, parentGroupSlug, spaceSlug])

  const groupSlug = resolvedSpaceGroupSlug || parentGroupSlug
  const urlOpts = spaceSlug
    ? { context: routeParams.context, groupSlug: parentGroupSlug, spaceSlug }
    : { context: routeParams.context, groupSlug }
  return { groupSlug, parentGroupSlug, spaceSlug, urlOpts }
}

/** Resolves the group slug used for data fetching — space slug when inside a space route, else route groupSlug. */
export function useEffectiveGroupSlug () {
  return useGroupRouteOpts().groupSlug
}
