import React, { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import Loading from 'components/Loading'
import { SpaceGroupSlugContext } from 'contexts/SpaceGroupContext'
import useRouteParams from 'hooks/useRouteParams'
import ChatRoom from 'routes/ChatRoom'
import GroupDetail from 'routes/GroupDetail'
import MembershipRequestsTab from 'routes/GroupSettings/MembershipRequestsTab'
import GroupWelcomePage from 'routes/GroupWelcomePage'
import MapExplorer from 'routes/MapExplorer'
import MemberProfile from 'routes/MemberProfile'
import Members from 'routes/Members'
import Moderation from 'routes/Moderation'
import PostDetail from 'routes/PostDetail'
import SpaceAboutModal from 'routes/SpaceAboutModal'
import SpaceJoinPage from 'routes/SpaceJoinPage'
import FundingRoundSubmissionsView from 'routes/FundingRoundSubmissionsView/FundingRoundSubmissionsView'
import ManageRoundView from 'routes/ManageRoundView/ManageRoundView'
import TrackActionsView from 'routes/TrackActionsView/TrackActionsView'
import ViewContent from 'routes/ViewContent'
import ContextMenuGrid from 'routes/AuthLayoutRouter/components/ContextMenu/ContextMenuGrid'
import fetchForGroup from 'store/actions/fetchForGroup'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getGroupViews } from 'store/selectors/getGroupViews'
import getMyMemberships from 'store/selectors/getMyMemberships'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { RESP_ADD_MEMBERS } from 'store/constants'
import { localSpaceSlug, spaceUrl, POST_DETAIL_MATCH } from '@hylo/navigation'
import { viewAcceptedByPostTypes } from 'store/models/GroupView'
import { isDrawerNavLayout } from 'util/mobile'

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
  const navigate = useNavigate()
  const location = useLocation()
  const routeParams = useRouteParams()

  // The About modal is a querystring overlay (?about=1) so it floats over
  // whatever view is open — as a sibling route it unmounted the view behind it,
  // leaving the modal over a blank pane
  const aboutOpen = new URLSearchParams(location.search).has('about')
  const closeAbout = () => {
    const params = new URLSearchParams(location.search)
    params.delete('about')
    const search = params.toString()
    navigate(`${location.pathname}${search ? `?${search}` : ''}`)
  }
  const parentSlug = routeParams.groupSlug
  const localSlug = routeParams.spaceSlug

  const parentGroupFromStore = useSelector(state => getGroupForSlug(state, parentSlug))
  const parentGroup = parentGroupProp || parentGroupFromStore
  const groupViews = useSelector(state => getGroupViews(state, parentGroup))

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
  const spaceChatMissingLastRead = (spaceGroup?.groupViews?.items || []).some(
    view => view.type === 'chat' && !Object.prototype.hasOwnProperty.call(view, 'lastReadPostId')
  )
  const needsSpaceGroupViews = !spaceGroupViewsLoaded || spaceChatMissingLastRead

  const myMemberships = useSelector(getMyMemberships)
  const isSpaceMember = useMemo(
    () => Boolean(spaceGroupId && myMemberships.some(m => m.group.id === spaceGroupId)),
    [spaceGroupId, myMemberships]
  )
  const canAddSpaceMembers = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADD_MEMBERS,
    groupId: spaceGroupId
  }))

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

  if (!parentGroup || !localSlug) return <Loading />
  if (!linkedSpace) return <Loading />

  // Non-members: about page is public-ish (GroupDetail); everything else is the join interstitial
  if (!isSpaceMember) {
    return (
      <SpaceGroupSlugContext.Provider value={spaceFullSlug}>
        <Routes>
          <Route path='about/*' element={<GroupDetail context='groups' forCurrentGroup />} />
          {canAddSpaceMembers && <Route path='requests' element={<MembershipRequestsTab />} />}
          <Route path='*' element={<SpaceJoinPage />} />
        </Routes>
      </SpaceGroupSlugContext.Provider>
    )
  }

  if (spaceFullSlug && (!spaceGroup || needsSpaceGroupViews)) return <Loading />

  const homeRoute = spaceGroup?.homeRoute || linkedSpace?.homeRoute || '/welcome'
  const spaceBase = spaceUrl(parentSlug, localSlug)
  const resolvedSpace = spaceGroup || linkedSpace

  // Entering a space should land on its menu, not skip straight into a view —
  // unless a menu is still visible elsewhere. In two column that is the sidebar,
  // so going to the home view loses nothing. On a drawer layout the sidebar has
  // slid off screen, so skipping the menu removes the only step where you can see
  // what the space contains, and the way back is a drawer you have to know about.
  const visibleSpaceViews = (resolvedSpace?.groupViews?.items || [])
    .filter(view => view.order != null)
    .filter(view => viewAcceptedByPostTypes(view.type, resolvedSpace?.acceptedPostTypes))
  // A menu holding a single card is worse than the view it would open —
  // unless we're editing, in which case the menu is the point (add/reorder views).
  const isEditingMenu = new URLSearchParams(location.search).get('edit') === 'true'
  const showSpaceMenu = (isOneColumnGroup || isDrawerNavLayout()) && (visibleSpaceViews.length > 1 || isEditingMenu)
  const spaceIndexElement = showSpaceMenu
    ? <ContextMenuGrid group={parentGroup} spaceGroup={resolvedSpace} />
    // Carry the search through the redirect, or landing on home would shed ?about=1
    : <Navigate to={{ pathname: `${spaceBase}${homeRoute}`, search: location.search }} replace />

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
        <Route path='members/:personId/*' element={<MemberProfile context='groups' />} />
        <Route path='members/*' element={<Members context='groups' />} />
        <Route path='requests' element={<MembershipRequestsTab />} />
        <Route path='chat/*' element={<ChatRoom context='groups' showHomeWelcome={false} />} />
        <Route path='track-actions/*' element={<TrackActionsView />} />
        <Route path='funding-round-submissions/*' element={<FundingRoundSubmissionsView />} />
        <Route path='manage-round/*' element={<ManageRoundView />} />
        <Route path='moderation/*' element={<Moderation context='groups' />} />
        {/* Legacy path links land on the home view with the overlay open */}
        <Route path='about/*' element={<Navigate to={{ pathname: `${spaceBase}${homeRoute}`, search: '?about=1' }} replace />} />
        <Route path={POST_DETAIL_MATCH} element={<PostDetail />} />
        <Route path='*' element={spaceIndexElement} />
      </Routes>
      {aboutOpen && <SpaceAboutModal onClose={closeAbout} />}
    </SpaceGroupSlugContext.Provider>
  )
}
