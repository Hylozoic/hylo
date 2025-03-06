import React, { useEffect, useMemo, useRef, useState } from 'react'
import { matchPath, Route, Routes, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { IntercomProvider } from 'react-use-intercom'
import { Helmet } from 'react-helmet'
import Div100vh from 'react-div-100vh'
import { get, some } from 'lodash/fp'
import { useResizeDetector } from 'react-resize-detector'
import { cn } from 'util/index'
import mixpanel from 'mixpanel-browser'
import config, { isTest } from 'config/index'
import ContextMenu from './components/ContextMenu'
import CreateModal from 'components/CreateModal'
import GlobalNav from './components/GlobalNav'
import NotFound from 'components/NotFound'
import SocketListener from 'components/SocketListener'
import SocketSubscriber from 'components/SocketSubscriber'
import { useLayoutFlags } from 'contexts/LayoutFlagsContext'
import ViewHeader from 'components/ViewHeader'
import useRouteParams from 'hooks/useRouteParams'
import getReturnToPath from 'store/selectors/getReturnToPath'
import setReturnToPath from 'store/actions/setReturnToPath'
import fetchCommonRoles from 'store/actions/fetchCommonRoles'
import fetchPlatformAgreements from 'store/actions/fetchPlatformAgreements'
import fetchForCurrentUser from 'store/actions/fetchForCurrentUser'
import fetchForGroup from 'store/actions/fetchForGroup'
import fetchThreads from 'store/actions/fetchThreads'
import getMe from 'store/selectors/getMe'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getMyGroupMembership from 'store/selectors/getMyGroupMembership'
import { getSignupInProgress } from 'store/selectors/getAuthState'
import {
  POST_DETAIL_MATCH, GROUP_DETAIL_MATCH, postUrl,
  groupHomeUrl
} from 'util/navigation'
import { CENTER_COLUMN_ID, DETAIL_COLUMN_ID } from 'util/scrolling'
import AllTopics from 'routes/AllTopics'
import AllView from 'routes/AllView'
import ChatRoom from 'routes/ChatRoom'
import CreateGroup from 'routes/CreateGroup'
import GroupDetail from 'routes/GroupDetail'
import GroupSettings from 'routes/GroupSettings'
import GroupWelcomeModal from 'routes/GroupWelcomeModal'
import GroupWelcomePage from 'routes/GroupWelcomePage'
import Groups from 'routes/Groups'
import GroupExplorer from 'routes/GroupExplorer'
import Drawer from './components/Drawer'
import Stream from 'routes/Stream'
import MapExplorer from 'routes/MapExplorer'
import JoinGroup from 'routes/JoinGroup'
import LandingPage from 'routes/LandingPage'
import Loading from 'components/Loading'
import MemberProfile from 'routes/MemberProfile'
import Members from 'routes/Members'
import Messages from 'routes/Messages'
import Moderation from 'routes/Moderation'
import PostDetail from 'routes/PostDetail'
import Search from 'routes/Search'
import WelcomeWizardRouter from 'routes/WelcomeWizardRouter'
import SiteTour from 'routes/AuthLayout/components/SiteTour'
import ThreadList from 'routes/Messages/ThreadList'

import UserSettings from 'routes/UserSettings'
import classes from './AuthLayout.module.scss'
import { localeLocalStorageSync } from 'util/locale'
import isWebView from 'util/webView'

export default function AuthLayout (props) {
  const resizeRef = useRef()
  const { width } = useResizeDetector({ handleHeight: false, targetRef: resizeRef })
  const { hideNavLayout } = useLayoutFlags()
  const withoutNav = isWebView() || hideNavLayout

  const location = useLocation()
  const routeParams = useRouteParams()

  // const pathMatchParams = useMemo(() => {
  //   const matches = [
  //     { path: `${POST_DETAIL_MATCH}` },
  //     { path: 'groups/:joinGroupSlug/join/:accessCode', context: 'groups' },
  //     { path: 'groups/:groupSlug/:view/*', context: 'groups' },
  //     { path: 'groups/:groupSlug/*', context: 'groups' },
  //     { path: 'all/:view/*', context: 'all' },
  //     { path: 'public/:view/*', context: 'public' },
  //     { path: 'all/*', context: 'all' },
  //     { path: 'public/*', context: 'public' },
  //     { path: 'welcome/*', context: 'welcome' },
  //     { path: 'my/*', context: 'my' },
  //     { path: 'messages/*', context: 'messages' }
  //   ]
  //   const match = matches.find(match => matchPath(match, location.pathname))
  //   const matchResult = match ? matchPath(match, location.pathname) : null
  //   if (matchResult) {
  //     matchResult.params.context = match.context // XXX: kinda hacky, there's probably a better way to track "context"
  //     return matchResult.params
  //   }
  //   return { context: 'all' }
  // }, [location.pathname])

  const hasDetail = useMemo(() => {
    // TODO: fix this hacky way to determine whether to open up the detail pane
    const detailRegex = /\/(group|post)\/([a-zA-Z0-9-]+)/
    return detailRegex.test(location.pathname) && (location.pathname.includes('map/') || location.pathname.includes('groups/group'))
  }, [location.pathname])

  const paramPostId = useMemo(() => {
    const match = location.pathname.match(/\/post\/(\d+)/)
    return match ? match[1] : null
  }, [location.pathname])

  const context = routeParams?.context || 'all'
  const currentGroupSlug = routeParams?.groupSlug
  const isMapView = routeParams?.view === 'map'
  const isWelcomeContext = context === 'welcome'

  const showCreateModal = useMemo(() => {
    return matchPath({ path: '/create/post/*' }, location.pathname)
  }, [location.pathname])

  const showEditModal = useMemo(() => {
    return matchPath({ path: '/post/:postId/edit/*' }, location.pathname)
  }, [location.pathname])

  // Store
  const dispatch = useDispatch()
  const currentGroup = useSelector(state => getGroupForSlug(state, currentGroupSlug))
  const currentGroupMembership = useSelector(state => getMyGroupMembership(state, currentGroupSlug))
  const currentUser = useSelector(getMe)
  const isDrawerOpen = useSelector(state => get('AuthLayout.isDrawerOpen', state))
  const isNavOpen = useSelector(state => get('AuthLayout.isNavOpen', state)) // For mobile nav
  const memberships = useSelector(getMyMemberships)
  const returnToPath = useSelector(getReturnToPath)
  const signupInProgress = useSelector(getSignupInProgress)

  const [currentUserLoading, setCurrentUserLoading] = useState(true)
  const [currentGroupLoading, setCurrentGroupLoading] = useState()

  useEffect(() => {
    (async function () {
      await dispatch(fetchCommonRoles())
      await dispatch(fetchForCurrentUser())
      setCurrentUserLoading(false)
      dispatch(fetchPlatformAgreements())
      dispatch(fetchThreads())
    })()
  }, [])

  useEffect(() => {
    if (currentUser?.id) {
      mixpanel.identify(currentUser.id)
      mixpanel.people.set({
        $name: currentUser.name,
        $email: currentUser.email,
        $location: currentUser.location
      })

      if (currentUser?.settings?.locale) localeLocalStorageSync(currentUser?.settings?.locale)
    }
  }, [currentUser?.email, currentUser?.id, currentUser?.location, currentUser?.name, currentUser?.settings?.locale])

  useEffect(() => {
    // Add all current group membershps to mixpanel user
    mixpanel.set_group('groupId', memberships.map(m => m.group.id))

    if (currentGroup?.id) {
      // Setup group profile info
      mixpanel.get_group('groupId', currentGroup.id).set({
        $location: currentGroup.location,
        $name: currentGroup.name,
        type: currentGroup.type
      })
    }
  }, [currentGroup?.id, currentGroup?.location, currentGroup?.name, currentGroup?.type, memberships])

  useEffect(() => {
    (async function () {
      if (currentGroupSlug) {
        setCurrentGroupLoading(true)
        await dispatch(fetchForGroup(currentGroupSlug))
        setCurrentGroupLoading(false)
      }
    })()
  }, [currentGroupSlug])

  // Scroll to top of center column when context, groupSlug, or view changes
  useEffect(() => {
    const centerColumn = document.getElementById(CENTER_COLUMN_ID)
    if (centerColumn) centerColumn.scrollTop = 0
  }, [routeParams.context, routeParams.groupSlug, routeParams.view])

  if (currentUserLoading) {
    return (
      <div className={classes.container} data-testid='loading-screen'>
        <Loading type='loading-fullscreen' />
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to='/login' state={{ from: location }} replace />
  }

  // Layout props, flags, and event handlers
  const intercomProps = {
    hideDefaultLauncher: true,
    userHash: currentUser?.intercomHash,
    email: currentUser?.email,
    name: currentUser?.name,
    userId: currentUser?.id
  }

  if (!signupInProgress && returnToPath) {
    const returnToPathName = new URL(returnToPath, 'https://hylo.com')?.pathname
    if (location.pathname === returnToPathName) {
      dispatch(setReturnToPath())
    } else {
      return <Navigate to={returnToPath} />
    }
  }

  if (signupInProgress && !isWelcomeContext) {
    return <Navigate to='/welcome' replace />
  }

  if (!currentGroupMembership && hasDetail && paramPostId && currentGroupSlug) {
    /* There are times when users will be send to a path where they have access to the POST on that path but not to the GROUP on that path
      This redirect replaces the non-accessible groupSlug from the path with '/all', for a better UI experience
    */
    return <Navigate to={postUrl(paramPostId, { context: 'all', groupSlug: null })} />
  }

  /* First time viewing a group redirect to welcome page if it exists, otherwise home view */
  // XXX: this is a hack, figure out better way to do this
  if (currentGroupMembership && !get('lastViewedAt', currentGroupMembership)) {
    currentGroupMembership.update({ lastViewedAt: (new Date()).toISOString() })
    if (currentGroup?.settings?.showWelcomePage) {
      return <Navigate to={`/groups/${currentGroupSlug}/welcome`} replace />
    } else {
      return <Navigate to={groupHomeUrl({ routeParams, group: currentGroup })} replace />
    }
  }

  if (currentGroupSlug && !currentGroup && !currentGroupLoading) {
    return <NotFound />
  }

  if (currentGroupLoading) {
    return <Loading />
  }

  const showMenuBadge = some(m => m.newPostCount > 0, memberships)

  const isSingleColumn = (currentGroupSlug && !currentGroupMembership) ||
    matchPath({ path: '/members/:personId' }, location.pathname)

  // When joining a group by invitation Group Welcome Modal (join form)
  const showTourPrompt = !signupInProgress &&
    !get('settings.alreadySeenTour', currentUser) &&
    // Show group welcome modal before tour
    !get('settings.showJoinForm', currentGroupMembership) &&
    // Don't show tour on non-member group details page
    !isSingleColumn

  return (
    <IntercomProvider appId={isTest ? '' : config.intercom.appId} autoBoot autoBootProps={intercomProps}>
      <Helmet>
        <title>{currentGroup ? `${currentGroup.name} | ` : ''}Hylo</title>
        <meta name='description' content='Prosocial Coordination for a Thriving Planet' />
        <script id='greencheck' type='application/json'>
          {`{ 'id': '${currentUser.id}', 'fullname': '${currentUser.name}', 'description': '${currentUser.tagline}', 'image': '${currentUser.avatarUrl}' }`}
        </script>
      </Helmet>

      <Div100vh className={cn('flex flex-row items-stretch bg-midground', { [classes.mapView]: isMapView, [classes.singleColumn]: isSingleColumn, [classes.detailOpen]: hasDetail })}>
        <div ref={resizeRef} className={cn(classes.main, { [classes.mapView]: isMapView, [classes.withoutNav]: withoutNav, [classes.mainPad]: !withoutNav })}>
          <div className={cn('AuthLayoutNavContainer hidden sm:flex flex-row max-w-420 h-full', { 'flex absolute sm:relative': isNavOpen })}>
            {!withoutNav && (
              <>
                <GlobalNav
                  group={currentGroup}
                  currentUser={currentUser}
                  routeParams={routeParams}
                  showMenuBadge={showMenuBadge}
                />
                {isDrawerOpen && <Drawer className={cn(classes.drawer)} group={currentGroup} context={context} />}
              </>
            )}

            {(!currentGroupSlug || (currentGroup && currentGroupMembership))
              ? context === 'messages'
                ? <ThreadList />
                : <ContextMenu context={context} currentGroup={currentGroup} mapView={isMapView} />
              : null}
          </div> {/* END NavContainer */}

          <div className='AuthLayoutCenterContainer flex flex-col h-full w-full'>
            <ViewHeader />
            <div className={cn(classes.center, { [classes.withoutNav]: withoutNav })} id={CENTER_COLUMN_ID}>
              {/* When viewing a group you are not a member of show group detail page */}
              {currentGroupSlug && !currentGroupMembership
                ? <GroupDetail context='groups' group={currentGroup} />
                : <Outlet />}
            </div>

            <div className={cn(classes.detail, { [classes.hidden]: !hasDetail })} id={DETAIL_COLUMN_ID}>
              <Routes>
                {/* All context routes */}
                <Route path={`${POST_DETAIL_MATCH}`} element={<PostDetail />} />
                <Route path={`${GROUP_DETAIL_MATCH}`} element={<GroupDetail />} />

                {/* Public context routes */}
                {/* <Route path={`/public/groups/${POST_DETAIL_MATCH}`} element={<PostDetail context='public' />} />
                <Route path={`/public/map/${POST_DETAIL_MATCH}`} element={<PostDetail context='public' />} />
                <Route path={`/public/map/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='public' />} />
                <Route path={`/public/groups/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='public' />} /> */}

                {/* My context routes */}
                {/* <Route path={`/my/mentions/${POST_DETAIL_MATCH}`} element={<PostDetail context='my' />} />
                <Route path={`/my/interactions/${POST_DETAIL_MATCH}`} element={<PostDetail context='my' />} />
                <Route path={`/my/posts/${POST_DETAIL_MATCH}`} element={<PostDetail context='my' />} />
                <Route path={`/my/announcements/${POST_DETAIL_MATCH}`} element={<PostDetail context='my' />} /> */}

                {/* Groups context routes */}
                {/* <Route path={`/groups/:groupSlug/map/${POST_DETAIL_MATCH}`} element={<PostDetail context='groups' />} />
                <Route path={`/groups/:groupSlug/custom/:customViewId/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />
                <Route path={`/groups/:groupSlug/groups/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />
                <Route path={`/groups/:groupSlug/map/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />
                <Route path={`/groups/:groupSlug/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} /> */}

                {/* Other routes */}
                {/* <Route path={`/members/:personId/${POST_DETAIL_MATCH}`} element={<PostDetail />} /> */}
              </Routes>
            </div>
          </div>
        </div>
      </Div100vh>

      {!isWebView() && currentGroup && <GroupWelcomeModal />}
      {showTourPrompt && <SiteTour windowWidth={width} />}
      {showCreateModal && <CreateModal />}
      {showEditModal && <CreateModal editingPost />}

      <SocketListener location={location} groupSlug={currentGroupSlug} />
      <SocketSubscriber type='group' id={get('slug', currentGroup)} />
    </IntercomProvider>
  )
}

