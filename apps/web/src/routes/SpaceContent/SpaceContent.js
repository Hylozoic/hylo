import React, { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import Loading from 'components/Loading'
import { SpaceGroupSlugContext } from 'contexts/SpaceGroupContext'
import useRouteParams from 'hooks/useRouteParams'
import useGroupViews from 'hooks/useGroupViews'
import ChatRoom from 'routes/ChatRoom'
import GroupAboutPage from 'routes/GroupAboutPage'
import MembershipRequestsTab from 'routes/GroupSettings/MembershipRequestsTab'
import GroupWelcomePage from 'routes/GroupWelcomePage'
import MapExplorer from 'routes/MapExplorer'
import MemberProfile from 'routes/MemberProfile'
import Members from 'routes/Members'
import PostDetail from 'routes/PostDetail'
import SpaceJoinPage from 'routes/SpaceJoinPage'
import FundingRoundSubmissionsView from 'routes/FundingRoundSubmissionsView/FundingRoundSubmissionsView'
import ManageRoundView from 'routes/ManageRoundView/ManageRoundView'
import TrackActionsView from 'routes/TrackActionsView/TrackActionsView'
import ViewContent from 'routes/ViewContent'
import SpaceCollection from 'routes/SpaceCollection'
import ContextMenuGrid from 'routes/AuthLayoutRouter/components/ContextMenu/ContextMenuGrid'
import { setMembershipLastViewedAt } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import fetchForGroup from 'store/actions/fetchForGroup'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getMyMemberships from 'store/selectors/getMyMemberships'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { RESP_ADD_MEMBERS } from 'store/constants'
import { localSpaceSlug, spaceHomeRoutePath, spaceUrl, POST_DETAIL_MATCH } from '@hylo/navigation'
import { isDrawerNavLayout } from 'util/mobile'
import shouldLandOnWelcome from 'util/shouldLandOnWelcome'

/**
 * Resolves a space group from the parent menu or from More Spaces (off-menu spaces).
 * Menu spaces live on groupViews; off-menu spaces live on group.spaces.
 */
function resolveSpaceGroup (parentGroup, groupViews, parentSlug, localSlug) {
  if (!localSlug || !parentSlug) return null

  const menuSpace = (groupViews || []).find(v =>
    v.type === 'space' &&
    localSpaceSlug(parentSlug, v.linkedGroup?.slug) === localSlug
  )
  if (menuSpace?.linkedGroup) return menuSpace.linkedGroup

  const offMenuSpace = (parentGroup?.spaces?.items || []).find(space =>
    localSpaceSlug(parentSlug, space.slug) === localSlug
  )
  return offMenuSpace || null
}

/**
 * Renders space views at /groups/:parentSlug/spaces/:spaceSlug/* while the
 * ContextMenu continues to show the parent group's navigation.
 * The space index shows ContextMenuGrid (the space's own menu) whenever no menu
 * is visible alongside it — one-column groups, and any drawer-width viewport —
 * and otherwise redirects to the space's home view.
 */
export default function SpaceContent ({ parentGroup: parentGroupProp, isOneColumnGroup = false }) {
  const dispatch = useDispatch()
  const location = useLocation()
  const routeParams = useRouteParams()

  const parentSlug = routeParams.groupSlug
  const localSlug = routeParams.spaceSlug

  const parentGroupFromStore = useSelector(state => getGroupForSlug(state, parentSlug))
  const parentGroup = parentGroupProp || parentGroupFromStore
  const groupViews = useGroupViews(parentGroup)

  const linkedSpace = useMemo(
    () => resolveSpaceGroup(parentGroup, groupViews, parentSlug, localSlug),
    [parentGroup, groupViews, parentSlug, localSlug]
  )

  const spaceFullSlug = linkedSpace?.slug
  const spaceGroup = useSelector(state => getGroupForSlug(state, spaceFullSlug))
  const spaceGroupId = spaceGroup?.id || linkedSpace?.id
  const spaceGroupViewsLoaded = spaceGroup?.groupViews != null
  // Nested parent/space fetches may populate groupViews without lastReadPostId. ChatRoom
  // restores scroll from that field — wait for a views fetch that includes it.
  // Nested linkedGroup.groupViews copies (from a parent fetch) may omit lastReadPostId
  // while still carrying newPostCount. A dedicated space fetchGroupViews always requests
  // both — only block on partial nested copies, not when lastReadPostId is simply null.
  const spaceChatMissingLastRead = (spaceGroup?.groupViews?.items || []).some(
    view => view.type === 'chat' &&
      view.newPostCount !== undefined &&
      !Object.prototype.hasOwnProperty.call(view, 'lastReadPostId')
  )
  const needsSpaceGroupViews = !spaceGroupViewsLoaded || spaceChatMissingLastRead

  const myMemberships = useSelector(getMyMemberships)
  const currentUser = useSelector(getMe)
  const isSpaceMember = useMemo(
    () => Boolean(spaceGroupId && myMemberships.some(m => String(m.group?.id) === String(spaceGroupId))),
    [spaceGroupId, myMemberships]
  )
  const spaceMembership = useMemo(
    () => myMemberships.find(m => String(m.group?.id) === String(spaceGroupId)),
    [myMemberships, spaceGroupId]
  )
  const canAddSpaceMembers = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADD_MEMBERS,
    groupId: spaceGroupId
  }))
  const onWelcomePath = Boolean(localSlug && location.pathname.includes(`/spaces/${localSlug}/welcome`))

  // Cold deep links: fetchForGroup(parentSlug) doesn't include the spaces list,
  // and the ContextMenu's fetchGroupSpaces may never fire (or hasn't yet), so
  // linkedSpace can't resolve and the Loading gate below would never clear.
  useEffect(() => {
    if (parentGroup?.id && localSlug && !linkedSpace) {
      dispatch(fetchGroupSpaces(parentGroup.id))
    }
  }, [dispatch, parentGroup?.id, localSlug, linkedSpace])

  useEffect(() => {
    if (spaceFullSlug && !spaceGroup) {
      dispatch(fetchForGroup(spaceFullSlug))
    }
  }, [dispatch, spaceFullSlug, spaceGroup])

  useEffect(() => {
    if (isSpaceMember && spaceGroupId && needsSpaceGroupViews) {
      dispatch(fetchGroupViews(spaceGroupId))
    }
  }, [dispatch, isSpaceMember, spaceGroupId, needsSpaceGroupViews])

  // Record first visit only after any welcome redirect, so lastViewedAt is not
  // set while we still intend to send the member to /welcome.
  useEffect(() => {
    if (!isSpaceMember || !spaceGroupId || !currentUser?.id || !spaceFullSlug) return
    if (!spaceMembership || spaceMembership.lastViewedAt) return
    if (spaceGroup?.groupViews == null) return
    if (shouldLandOnWelcome(spaceGroup, spaceMembership, { onWelcomePath })) return
    dispatch(setMembershipLastViewedAt(spaceGroupId, currentUser.id, new Date().toISOString()))
    dispatch(fetchForGroup(spaceFullSlug))
  }, [dispatch, isSpaceMember, spaceGroupId, currentUser?.id, spaceFullSlug, spaceMembership, spaceGroup, onWelcomePath])

  if (!parentGroup || !localSlug) return <Loading />
  if (!linkedSpace) return <Loading />

  const spaceBase = spaceUrl(parentSlug, localSlug)
  const settingsRedirect = <Navigate to={spaceBase} replace />
  const settingsRequestsRedirect = <Navigate to={`${spaceBase}/requests`} replace />

  // Non-members (including /about from a card's (i)): join interstitial only.
  if (!isSpaceMember) {
    return (
      <SpaceGroupSlugContext.Provider value={spaceFullSlug}>
        <Routes>
          {canAddSpaceMembers && <Route path='requests' element={<MembershipRequestsTab />} />}
          {canAddSpaceMembers && <Route path='settings/requests' element={settingsRequestsRedirect} />}
          <Route path='settings/*' element={settingsRedirect} />
          <Route path='*' element={<SpaceJoinPage />} />
        </Routes>
      </SpaceGroupSlugContext.Provider>
    )
  }

  if (spaceFullSlug && (!spaceGroup || needsSpaceGroupViews)) return <Loading />

  const resolvedSpace = spaceGroup || linkedSpace
  const homeRoute = spaceHomeRoutePath({
    homeRoute: spaceGroup?.homeRoute || linkedSpace?.homeRoute,
    groupViews: spaceGroup?.groupViews || linkedSpace?.groupViews,
    track: spaceGroup?.track || linkedSpace?.track,
    fundingRound: spaceGroup?.fundingRound || linkedSpace?.fundingRound
  })

  // Entering a space should land on its menu, not skip straight into a view —
  // unless a menu is still visible elsewhere. In two column that is the sidebar,
  // so going to the home view loses nothing. On a drawer layout the sidebar has
  // slid off screen, so skipping the menu removes the only step where you can see
  // what the space contains, and the way back is a drawer you have to know about.
  const visibleSpaceViews = (resolvedSpace?.groupViews?.items || [])
    .filter(view => view.order != null)
  // A menu holding a single card is worse than the view it would open —
  // unless we're editing, in which case the menu is the point (add/reorder views).
  const isEditingMenu = new URLSearchParams(location.search).get('edit') === 'true'
  const showSpaceMenu = (isOneColumnGroup || isDrawerNavLayout()) && (visibleSpaceViews.length > 1 || isEditingMenu)
  const spaceIndexElement = showSpaceMenu
    ? <ContextMenuGrid group={parentGroup} spaceGroup={resolvedSpace} />
    : <Navigate to={{ pathname: `${spaceBase}${homeRoute}`, search: location.search }} replace />

  if (shouldLandOnWelcome(resolvedSpace, spaceMembership, { onWelcomePath })) {
    return <Navigate to={`${spaceBase}/welcome${location.search}`} replace />
  }

  return (
    <SpaceGroupSlugContext.Provider value={spaceFullSlug}>
      <Routes>
        <Route index element={spaceIndexElement} />
        <Route path='welcome/*' element={<GroupWelcomePage />} />
        <Route path='map/*' element={<MapExplorer context='groups' view='map' />} />
        <Route path='all/*' element={<ViewContent context='groups' view='all' />} />
        <Route path='discussions/*' element={<ViewContent context='groups' view='discussions' />} />
        <Route path='events/*' element={<ViewContent context='groups' view='events' />} />
        <Route path='resources/*' element={<ViewContent context='groups' view='resources' />} />
        <Route path='projects/*' element={<ViewContent context='groups' view='projects' />} />
        <Route path='proposals/*' element={<ViewContent context='groups' view='proposals' />} />
        <Route path='requests-and-offers/*' element={<ViewContent context='groups' view='requests-and-offers' />} />
        <Route path='custom/:customViewId/*' element={<ViewContent context='groups' view='custom' />} />
        <Route path='collection/:customViewId/*' element={<ViewContent context='groups' view='collection' />} />
        <Route path='space-collection/:viewId/*' element={<SpaceCollection group={resolvedSpace} parentGroup={parentGroup} />} />
        <Route path='members/:personId/*' element={<MemberProfile context='groups' />} />
        <Route path='members/*' element={<Members context='groups' />} />
        <Route path='requests' element={<MembershipRequestsTab />} />
        <Route path='settings/requests' element={settingsRequestsRedirect} />
        <Route path='settings/*' element={settingsRedirect} />
        <Route path='chat/*' element={<ChatRoom context='groups' />} />
        <Route path='track-actions/*' element={<TrackActionsView />} />
        <Route path='funding-round-submissions/*' element={<FundingRoundSubmissionsView />} />
        <Route path='manage-round/*' element={<ManageRoundView />} />
        <Route path='moderation/*' element={<Navigate to='about/moderation' replace />} />
        <Route path='about/*' element={<GroupAboutPage />} />
        <Route path={POST_DETAIL_MATCH} element={<PostDetail />} />
        <Route path='*' element={spaceIndexElement} />
      </Routes>
    </SpaceGroupSlugContext.Provider>
  )
}
