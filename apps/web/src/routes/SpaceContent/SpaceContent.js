import React, { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Navigate, Route, Routes } from 'react-router-dom'

import Loading from 'components/Loading'
import { SpaceGroupSlugContext } from 'contexts/SpaceGroupContext'
import useRouteParams from 'hooks/useRouteParams'
import ChatRoom from 'routes/ChatRoom'
import GroupDetail from 'routes/GroupDetail'
import GroupWelcomePage from 'routes/GroupWelcomePage'
import MapExplorer from 'routes/MapExplorer'
import MemberProfile from 'routes/MemberProfile'
import Members from 'routes/Members'
import Moderation from 'routes/Moderation'
import PostDetail from 'routes/PostDetail'
import SpaceJoinPage from 'routes/SpaceJoinPage'
import Stream from 'routes/Stream'
import FundingRoundSubmissionsView from 'routes/FundingRoundSubmissionsView/FundingRoundSubmissionsView'
import ManageRoundView from 'routes/ManageRoundView/ManageRoundView'
import TrackActionsView from 'routes/TrackActionsView/TrackActionsView'
import ViewContent from 'routes/ViewContent'
import ContextMenuGrid from 'routes/AuthLayoutRouter/components/ContextMenu/ContextMenuGrid'
import fetchForGroup from 'store/actions/fetchForGroup'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getGroupViews } from 'store/selectors/getGroupViews'
import getMyMemberships from 'store/selectors/getMyMemberships'
import { localSpaceSlug, spaceUrl, POST_DETAIL_MATCH } from '@hylo/navigation'

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
 * For one-column groups, the space index shows ContextMenuGrid (space menu)
 * instead of redirecting to the home view.
 */
export default function SpaceContent ({ parentGroup: parentGroupProp, isOneColumnGroup = false }) {
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
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

  const myMemberships = useSelector(getMyMemberships)
  const isSpaceMember = useMemo(
    () => Boolean(spaceGroupId && myMemberships.some(m => m.group.id === spaceGroupId)),
    [spaceGroupId, myMemberships]
  )

  useEffect(() => {
    if (spaceFullSlug && !spaceGroup) {
      dispatch(fetchForGroup(spaceFullSlug))
    }
  }, [dispatch, spaceFullSlug, spaceGroup])

  useEffect(() => {
    if (isSpaceMember && spaceGroupId && !spaceGroupViewsLoaded) {
      dispatch(fetchGroupViews(spaceGroupId))
    }
  }, [dispatch, isSpaceMember, spaceGroupId, spaceGroupViewsLoaded])

  if (!parentGroup || !localSlug) return <Loading />
  if (!linkedSpace) return <Loading />

  // Non-members: about page is public-ish (GroupDetail); everything else is the join interstitial
  if (!isSpaceMember) {
    return (
      <SpaceGroupSlugContext.Provider value={spaceFullSlug}>
        <Routes>
          <Route path='about/*' element={<GroupDetail context='groups' forCurrentGroup />} />
          <Route path='*' element={<SpaceJoinPage />} />
        </Routes>
      </SpaceGroupSlugContext.Provider>
    )
  }

  if (spaceFullSlug && (!spaceGroup || !spaceGroupViewsLoaded)) return <Loading />

  const homeRoute = spaceGroup?.homeRoute || linkedSpace?.homeRoute || '/welcome'
  const spaceBase = spaceUrl(parentSlug, localSlug)
  const resolvedSpace = spaceGroup || linkedSpace

  return (
    <SpaceGroupSlugContext.Provider value={spaceFullSlug}>
      <Routes>
        <Route
          index
          element={
            isOneColumnGroup
              ? <ContextMenuGrid group={parentGroup} spaceGroup={resolvedSpace} />
              : <Navigate to={`${spaceBase}${homeRoute}`} replace />
          }
        />
        <Route path='welcome/*' element={<GroupWelcomePage />} />
        <Route path='map/*' element={<MapExplorer context='groups' view='map' />} />
        <Route path='all/*' element={<ViewContent context='groups' view='all' />} />
        <Route path='stream/*' element={<Stream context='groups' view='stream' />} />
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
        <Route path='chat/*' element={<ChatRoom context='groups' showHomeWelcome={false} />} />
        <Route path='track-actions/*' element={<TrackActionsView />} />
        <Route path='funding-round-submissions/*' element={<FundingRoundSubmissionsView />} />
        <Route path='manage-round/*' element={<ManageRoundView />} />
        <Route path='moderation/*' element={<Moderation context='groups' />} />
        <Route path='about/*' element={<GroupDetail context='groups' forCurrentGroup />} />
        <Route path={POST_DETAIL_MATCH} element={<PostDetail />} />
        <Route
          path='*'
          element={
            isOneColumnGroup
              ? <ContextMenuGrid group={parentGroup} spaceGroup={resolvedSpace} />
              : <Navigate to={`${spaceBase}${homeRoute}`} replace />
          }
        />
      </Routes>
    </SpaceGroupSlugContext.Provider>
  )
}
