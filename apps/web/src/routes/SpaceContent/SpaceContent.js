import React, { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Navigate, Route, Routes } from 'react-router-dom'

import Loading from 'components/Loading'
import { SpaceGroupSlugContext } from 'contexts/SpaceGroupContext'
import useRouteParams from 'hooks/useRouteParams'
import ChatRoom from 'routes/ChatRoom'
import GroupWelcomePage from 'routes/GroupWelcomePage'
import MapExplorer from 'routes/MapExplorer'
import MemberProfile from 'routes/MemberProfile'
import Members from 'routes/Members'
import Moderation from 'routes/Moderation'
import PostDetail from 'routes/PostDetail'
import Stream from 'routes/Stream'
import ViewContent from 'routes/ViewContent'
import fetchForGroup from 'store/actions/fetchForGroup'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getGroupViews } from 'store/selectors/getGroupViews'
import { localSpaceSlug, spaceUrl, POST_DETAIL_MATCH } from '@hylo/navigation'

/**
 * Renders space views at /groups/:parentSlug/spaces/:spaceSlug/* while the
 * ContextMenu continues to show the parent group's navigation.
 */
export default function SpaceContent () {
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const parentSlug = routeParams.groupSlug
  const localSlug = routeParams.spaceSlug

  const parentGroup = useSelector(state => getGroupForSlug(state, parentSlug))
  const groupViews = useSelector(state => getGroupViews(state, parentGroup))

  const spaceView = useMemo(() => {
    if (!localSlug || !groupViews?.length) return null
    return groupViews.find(v =>
      v.type === 'space' &&
      localSpaceSlug(parentSlug, v.linkedGroup?.slug) === localSlug
    )
  }, [groupViews, localSlug, parentSlug])

  const spaceFullSlug = spaceView?.linkedGroup?.slug
  const spaceGroup = useSelector(state => getGroupForSlug(state, spaceFullSlug))
  const spaceGroupId = spaceGroup?.id
  const spaceGroupViewsLoaded = spaceGroup?.groupViews != null

  useEffect(() => {
    if (spaceFullSlug && !spaceGroup) {
      dispatch(fetchForGroup(spaceFullSlug))
    }
  }, [dispatch, spaceFullSlug, spaceGroup])

  useEffect(() => {
    if (spaceGroupId && !spaceGroupViewsLoaded) {
      dispatch(fetchGroupViews(spaceGroupId))
    }
  }, [dispatch, spaceGroupId, spaceGroupViewsLoaded])

  if (!parentGroup || !localSlug) return <Loading />
  if (!spaceView) return <Loading />
  if (spaceFullSlug && (!spaceGroup || !spaceGroupViewsLoaded)) return <Loading />

  const homeRoute = spaceGroup?.homeRoute || spaceView.linkedGroup?.homeRoute || '/welcome'
  const spaceBase = spaceUrl(parentSlug, localSlug)

  return (
    <SpaceGroupSlugContext.Provider value={spaceFullSlug}>
      <Routes>
        <Route index element={<Navigate to={`${spaceBase}${homeRoute}`} replace />} />
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
        <Route path='track-actions/*' element={<ViewContent context='groups' view='track-actions' />} />
        <Route path='funding-round-submissions/*' element={<ViewContent context='groups' view='funding-round-submissions' />} />
        <Route path='moderation/*' element={<Moderation context='groups' />} />
        <Route path='about/*' element={<ViewContent context='groups' view='about' />} />
        <Route path={POST_DETAIL_MATCH} element={<PostDetail />} />
        <Route path='*' element={<Navigate to={`${spaceBase}${homeRoute}`} replace />} />
      </Routes>
    </SpaceGroupSlugContext.Provider>
  )
}
