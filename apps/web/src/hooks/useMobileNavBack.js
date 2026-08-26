import { useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import GroupViewPresenter from '@hylo/presenters/GroupViewPresenter'
import { localSpaceSlug, spaceHomeRoutePath, spaceUrl } from '@hylo/navigation'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useGroupViews from 'hooks/useGroupViews'
import useRouteParams from 'hooks/useRouteParams'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getPreviousLocation from 'store/selectors/getPreviousLocation'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { performMobileNavBack } from 'util/mobileNavBack'
import { isCardMenuPreference, isOneColumnLayout } from 'util/navigationLayout'

/**
 * Resolves the parent menu's space view (or a synthetic one for off-menu spaces).
 */
function resolveSpaceMenuView (parentGroup, groupViews, parentSlug, spaceSlug) {
  if (!spaceSlug || !parentSlug) return null

  const menuSpace = (groupViews || []).find(v =>
    v.type === 'space' &&
    localSpaceSlug(parentSlug, v.linkedGroup?.slug) === spaceSlug
  )
  if (menuSpace) return menuSpace

  const offMenuSpace = (parentGroup?.spaces?.items || []).find(space =>
    localSpaceSlug(parentSlug, space.slug) === spaceSlug
  )
  if (!offMenuSpace) return null

  return {
    type: 'space',
    name: offMenuSpace.name,
    icon: offMenuSpace.icon,
    linkedGroup: offMenuSpace
  }
}

/**
 * Shared inputs + action for header-chevon and Android hardware back.
 * ViewHeader also uses the derived layout/space values for breadcrumbs.
 */
export default function useMobileNavBack () {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { context, groupSlug, spaceSlug: routeSpaceSlug } = useRouteParams()
  const { headerDetails } = useViewHeader()
  const { spaceBreadcrumb } = headerDetails

  // More Spaces drill-in uses ?space= on /more-spaces rather than the space route.
  const isMoreSpacesPath = location.pathname.replace(/\/$/, '').endsWith('/more-spaces')
  const spaceSlug = routeSpaceSlug || (isMoreSpacesPath ? getQuerystringParam('space', location) : null)
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const groupViews = useGroupViews(spaceSlug ? group : null)
  const currentUser = useSelector(getMe)
  const myMemberships = useSelector(getMyMemberships)
  const previousLocation = useSelector(getPreviousLocation)

  const userGroupNavStyle = currentUser?.settings?.groupNavStyle
  const isOneColumnGroup = context === 'groups' && isOneColumnLayout(userGroupNavStyle, group?.settings?.layout)
  const isOneColumnContext = isCardMenuPreference(userGroupNavStyle) && ['my', 'all', 'public'].includes(context)
  const oneColumn = isOneColumnGroup || isOneColumnContext

  const spaceMenuView = useMemo(
    () => resolveSpaceMenuView(group, groupViews, groupSlug, spaceSlug),
    [group, groupViews, groupSlug, spaceSlug]
  )
  const spaceGroupFromStore = useSelector(state =>
    spaceMenuView?.linkedGroup?.slug ? getGroupForSlug(state, spaceMenuView.linkedGroup.slug) : null
  )
  const spaceGroup = spaceGroupFromStore || spaceMenuView?.linkedGroup
  const spaceGroupViews = useGroupViews(spaceGroup)
  const presentedSpaceView = useMemo(() => {
    if (spaceBreadcrumb === false) return null
    return spaceMenuView ? GroupViewPresenter(spaceMenuView) : null
  }, [spaceMenuView, spaceBreadcrumb])
  const isSpaceMember = useMemo(() => {
    const spaceId = spaceGroup?.id || spaceMenuView?.linkedGroup?.id
    if (!spaceId) return false
    return myMemberships.some(m => String(m.group?.id) === String(spaceId))
  }, [spaceGroup, spaceMenuView, myMemberships])

  // Single-view detection must not depend on the breadcrumb presenter — back
  // still has to leave the space when the header hides the space crumb.
  const singleSpaceView = useMemo(() => {
    if (isMoreSpacesPath || !spaceGroup) return null
    const views = spaceGroupViews.length > 0 ? spaceGroupViews : (spaceGroup.groupViews?.items || [])
    const visibleViews = views.filter(v => v.order != null)
    return visibleViews.length === 1 ? visibleViews[0] : null
  }, [spaceGroup, spaceGroupViews, isMoreSpacesPath])
  const isSingleViewSpace = Boolean(singleSpaceView)
  const hasSpaceMenu = useMemo(() => {
    if (!spaceGroup) return false
    const views = spaceGroupViews.length > 0 ? spaceGroupViews : (spaceGroup.groupViews?.items || [])
    return views.filter(v => v.order != null).length > 1
  }, [spaceGroup, spaceGroupViews])

  const spaceHomePath = useMemo(() => {
    if (!groupSlug || !spaceSlug || !spaceGroup) return null
    return spaceUrl(groupSlug, spaceSlug, spaceHomeRoutePath(spaceGroup)).replace(/\/$/, '')
  }, [groupSlug, spaceSlug, spaceGroup])

  const performBack = useCallback(() => {
    return performMobileNavBack({
      dispatch,
      navigate,
      headerDetails,
      previousLocation,
      pathname: location.pathname,
      fromMoreSpaces: Boolean(location.state?.fromMoreSpaces),
      groupSlug,
      spaceSlug,
      context,
      isOneColumnGroup,
      isOneColumnContext,
      oneColumn,
      isSingleViewSpace,
      hasSpaceMenu,
      spaceHomePath
    })
  }, [
    dispatch,
    navigate,
    headerDetails,
    previousLocation,
    location.pathname,
    location.state,
    groupSlug,
    spaceSlug,
    context,
    isOneColumnGroup,
    isOneColumnContext,
    oneColumn,
    isSingleViewSpace,
    hasSpaceMenu,
    spaceHomePath
  ])

  return {
    performBack,
    headerDetails,
    location,
    group,
    currentUser,
    groupSlug,
    spaceSlug,
    context,
    isOneColumnGroup,
    isOneColumnContext,
    oneColumn,
    isSingleViewSpace,
    presentedSpaceView,
    isSpaceMember
  }
}
