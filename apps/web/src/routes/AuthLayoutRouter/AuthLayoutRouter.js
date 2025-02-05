import React, { useEffect, useMemo, useRef, useState } from 'react'
import { matchPath, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { IntercomProvider } from 'react-use-intercom'
import { Helmet } from 'react-helmet'
import Div100vh from 'react-div-100vh'
import { get, some } from 'lodash/fp'
import { useResizeDetector } from 'react-resize-detector'
import { cn } from 'util/index'
import mixpanel from 'mixpanel-browser'
import config, { isTest } from 'config/index'
import CreateModal from 'components/CreateModal'
import GlobalNav from './components/GlobalNav'
import SocketListener from 'components/SocketListener'
import SocketSubscriber from 'components/SocketSubscriber'
import { useLayoutFlags } from 'contexts/LayoutFlagsContext'
import { ViewHeaderProvider } from 'contexts/ViewHeaderContext/ViewHeaderProvider'
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
import { toggleDrawer, toggleNavMenu } from './AuthLayoutRouter.store'
import getLastViewedGroup from 'store/selectors/getLastViewedGroup'
import {
  POST_DETAIL_MATCH, GROUP_DETAIL_MATCH, postUrl,
  widgetUrl
} from 'util/navigation'
import { CENTER_COLUMN_ID, DETAIL_COLUMN_ID } from 'util/scrolling'
import AllTopics from 'routes/AllTopics'
import AllView from 'routes/AllView'
import ChatRoom from 'routes/ChatRoom'
import CreateGroup from 'routes/CreateGroup'
import GroupDetail from 'routes/GroupDetail'
import GroupSettings from 'routes/GroupSettings'
import GroupWelcomeModal from 'routes/GroupWelcomeModal'
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
import ContextMenu from './components/ContextMenu'
import NotFound from 'components/NotFound'
import ViewHeader from 'components/ViewHeader'
import PostDetail from 'routes/PostDetail'
import Search from 'routes/Search'
import WelcomeWizardRouter from 'routes/WelcomeWizardRouter'
import SiteTour from 'routes/AuthLayoutRouter/components/SiteTour'
import ThreadList from 'routes/Messages/ThreadList'

import UserSettings from 'routes/UserSettings'
import { DEFAULT_CHAT_TOPIC, GROUP_TYPES } from 'store/models/Group'
import classes from './AuthLayoutRouter.module.scss'
import { findHomeWidget } from '@hylo/presenters/ContextWidgetPresenter'
import { localeLocalStorageSync } from 'util/locale'
import isWebView from 'util/webView'

export default function AuthLayoutRouter (props) {
  const resizeRef = useRef()
  const { width } = useResizeDetector({ handleHeight: false, targetRef: resizeRef })
  const navigate = useNavigate()
  const { hideNavLayout } = useLayoutFlags()
  const withoutNav = isWebView() || hideNavLayout

  // Setup `pathMatchParams` and `queryParams` (`matchPath` best only used in this section)
  const location = useLocation()
  const pathMatchParams = useMemo(() => {
    const matches = [
      { path: `${POST_DETAIL_MATCH}` },
      { path: 'groups/:joinGroupSlug/join/:accessCode', context: 'groups' },
      { path: 'groups/:groupSlug/:view/*', context: 'groups' },
      { path: 'groups/:groupSlug/*', context: 'groups' },
      { path: 'all/:view/*', context: 'all' },
      { path: 'public/:view/*', context: 'public' },
      { path: 'all/*', context: 'all' },
      { path: 'public/*', context: 'public' },
      { path: 'welcome/*', context: 'welcome' },
      { path: 'my/*', context: 'my' }
    ]
    const match = matches.find(match => matchPath(match, location.pathname))
    const matchResult = match ? matchPath(match, location.pathname) : null
    if (matchResult) {
      matchResult.params.context = match.context // XXX: kinda hacky, there's probably a better way to track "context"
      return matchResult.params
    }
    return { context: 'all' }
  }, [location.pathname])

  const hasDetail = useMemo(() => {
    const detailRegex = /\/(group|post)\/([a-zA-Z0-9-]+)/
    return detailRegex.test(location.pathname) && (location.pathname.includes('map/') || location.pathname.includes('explore/'))
  }, [location.pathname])

  const paramPostId = useMemo(() => {
    const match = location.pathname.match(/\/post\/(\d+)/)
    return match ? match[1] : null
  }, [location.pathname])

  const currentGroupSlug = pathMatchParams?.groupSlug
  const isMapView = pathMatchParams?.view === 'map'
  const isWelcomeContext = pathMatchParams?.context === 'welcome'

  // Store
  const dispatch = useDispatch()
  const currentGroup = useSelector(state => getGroupForSlug(state, currentGroupSlug))
  const currentGroupMembership = useSelector(state => getMyGroupMembership(state, currentGroupSlug))
  const currentUser = useSelector(getMe)
  const isDrawerOpen = useSelector(state => get('AuthLayoutRouter.isDrawerOpen', state))
  const isNavOpen = useSelector(state => get('AuthLayoutRouter.isNavOpen', state)) // For mobile nav
  const lastViewedGroup = useSelector(getLastViewedGroup)
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

  // Scroll to top of center column when context, groupSlug, or view changes (from `pathMatchParams`)
  useEffect(() => {
    const centerColumn = document.getElementById(CENTER_COLUMN_ID)
    if (centerColumn) centerColumn.scrollTop = 0
  }, [pathMatchParams?.context, pathMatchParams?.groupSlug, pathMatchParams?.view])

  if (currentUserLoading) {
    return (
      <div className={classes.container} data-testid='loading-screen'>
        <Loading type='loading-fullscreen' />
      </div>
    )
  }

  // Layout props, flags, and event handlers
  const intercomProps = {
    hideDefaultLauncher: true,
    userHash: currentUser.intercomHash,
    email: currentUser.email,
    name: currentUser.name,
    userId: currentUser.id
  }
  const handleCloseNav = () => isNavOpen && dispatch(toggleNavMenu())
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

  /* First time viewing a group redirect to home chat */
  // XXX: this is a hack, figure out better way to do this
  if (currentGroupMembership && !get('lastViewedAt', currentGroupMembership)) {
    currentGroupMembership.update({ lastViewedAt: (new Date()).toISOString() })
    setTimeout(() => {
      navigate(`/groups/${currentGroupSlug}/chat/${DEFAULT_CHAT_TOPIC}`, { replace: true })
    }, 100)
  }

  if (currentGroupSlug && !currentGroup && !currentGroupLoading) {
    return <NotFound />
  }

  const homeRoute = currentGroup?.contextWidgets?.items?.length > 0 ? <Navigate to={getHomeUrl({ routeParams: pathMatchParams, group: currentGroup })} replace /> : returnDefaultView(currentGroup, 'groups')

  return (
    <IntercomProvider appId={isTest ? '' : config.intercom.appId} autoBoot autoBootProps={intercomProps}>
      <Helmet>
        <title>{currentGroup ? `${currentGroup.name} | ` : ''}Hylo</title>
        <meta name='description' content='Prosocial Coordination for a Thriving Planet' />
        <script id='greencheck' type='application/json'>
          {`{ 'id': '${currentUser.id}', 'fullname': '${currentUser.name}', 'description': '${currentUser.tagline}', 'image': '${currentUser.avatarUrl}' }`}
        </script>
      </Helmet>

      <Routes>
        {/* Redirects for switching into global contexts, since these pages don't exist yet */}
        <Route path='public/members' element={<Navigate to='/public' replace />} />
        <Route path='public/settings' element={<Navigate to='/public' replace />} />
        <Route path='all/members' element={<Navigate to='/all' replace />} />
        <Route path='all/settings' element={<Navigate to='/all' replace />} />

        {/* Redirect manage notifications page to settings page when logged in */}
        <Route path='notifications' element={<Navigate to='/my/notifications' replace />} />

        {!isWebView() && (
          <>
            <Route path='groups/:groupSlug/*' element={<GroupWelcomeModal />} />

            {showTourPrompt && (
              <>
                <Route path='all/*' element={<SiteTour windowWidth={width} />} />
                <Route path='public/*' element={<SiteTour windowWidth={width} />} />
                <Route path='groups/*' element={<SiteTour windowWidth={width} />} />
              </>)}
          </>
        )}
      </Routes>

      <Routes>
        <Route path='groups/:groupSlug/topics/:topicName/create/*' element={<CreateModal context='groups' />} />
        <Route path='groups/:groupSlug/topics/:topicName/post/:postId/create/*' element={<CreateModal context='groups' />} />
        <Route path='groups/:groupSlug/topics/:topicName/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
        <Route path='groups/:groupSlug/chat/:topicName/create/*' element={<CreateModal context='groups' />} />
        <Route path='groups/:groupSlug/:view/create/*' element={<CreateModal context='groups' />} />
        <Route path='groups/:groupSlug/custom/:customViewId/create/*' element={<CreateModal context='groups' />} />
        <Route path='groups/:groupSlug/:view/post/:postId/create/*' element={<CreateModal context='groups' />} />
        <Route path='groups/:groupSlug/:view/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
        <Route path='groups/:groupSlug/create/*' element={<CreateModal context='groups' />} />
        <Route path='groups/:groupSlug/post/:postId/create/*' element={<CreateModal context='groups' />} />
        <Route path='groups/:groupSlug/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
        <Route path='public/topics/:topicName/create/*' element={<CreateModal context='public' />} />
        <Route path='public/topics/:topicName/post/:postId/create/*' element={<CreateModal context='public' />} />
        <Route path='public/topics/:topicName/post/:postId/edit/*' element={<CreateModal context='public' editingPost />} />
        <Route path='all/topics/:topicName/create/*' element={<CreateModal context='all' />} />
        <Route path='all/topics/:topicName/post/:postId/create/*' element={<CreateModal context='all' />} />
        <Route path='all/topics/:topicName/post/:postId/edit/*' element={<CreateModal context='all' editingPost />} />
        <Route path='all/:view/create/*' element={<CreateModal context='all' />} />
        <Route path='all/:view/post/:postId/create/*' element={<CreateModal context='all' />} />
        <Route path='all/:view/post/:postId/edit/*' element={<CreateModal context='all' editingPost />} />
        <Route path='public/:view/create/*' element={<CreateModal context='public' />} />
        <Route path='public/:view/post/:postId/create/*' element={<CreateModal context='public' />} />
        <Route path='public/:view/post/:postId/edit/*' element={<CreateModal context='public' editingPost />} />
        <Route path='my/:view/create/*' element={<CreateModal context='my' />} />
        <Route path='my/:view/post/:postId/create/*' element={<CreateModal context='my' />} />
        <Route path='my/:view/post/:postId/edit/*' element={<CreateModal context='my' editingPost />} />
        <Route path='public/create/*' element={<CreateModal context='public' />} />
        <Route path='public/post/:postId/create/*' element={<CreateModal context='public' />} />
        <Route path='public/post/:postId/edit/*' element={<CreateModal context='public' editingPost />} />
        <Route path='all/create/*' element={<CreateModal context='all' />} />
        <Route path='all/post/:postId/create/*' element={<CreateModal context='all' />} />
        <Route path='all/post/:postId/edit/*' element={<CreateModal context='all' editingPost />} />
      </Routes>

      <Div100vh className={cn('flex flex-row items-stretch bg-midground', { [classes.mapView]: isMapView, [classes.singleColumn]: isSingleColumn, [classes.detailOpen]: hasDetail })}>
        <div ref={resizeRef} className={cn(classes.main, { [classes.mapView]: isMapView, [classes.withoutNav]: withoutNav, [classes.mainPad]: !withoutNav })}>
          <div className={cn('AuthLayoutRouterNavContainer hidden sm:flex flex-row max-w-420 h-full', { 'flex absolute sm:relative': isNavOpen })}>
            {!withoutNav && (
              <>
                {/* Depends on `pathMatchParams` */}
                <GlobalNav
                  // onClick={handleCloseNav}
                  group={currentGroup}
                  currentUser={currentUser}
                  routeParams={pathMatchParams}
                  showMenuBadge={showMenuBadge}
                />
                {isDrawerOpen && <Drawer className={cn(classes.drawer)} group={currentGroup} context={pathMatchParams?.context} />}
              </>
            )}

            {(!currentGroupSlug || (currentGroup && currentGroupMembership)) &&
              <Routes>
                <Route path='public/*' element={<ContextMenu context={pathMatchParams?.context} currentGroup={currentGroup} mapView={isMapView} />} />
                <Route path='my/*' element={<ContextMenu context={pathMatchParams?.context} currentGroup={currentGroup} mapView={isMapView} />} />
                <Route path='all/*' element={<ContextMenu context={pathMatchParams?.context} currentGroup={currentGroup} mapView={isMapView} />} />
                <Route path='groups/:joinGroupSlug/join/:accessCode' />
                <Route path='groups/:groupSlug/*' element={<ContextMenu context={pathMatchParams?.context} currentGroup={currentGroup} mapView={isMapView} />} />
                <Route path='messages/:messageThreadId' element={<ThreadList />} />
                <Route path='messages' element={<ThreadList />} />
              </Routes>}
          </div> {/* END NavContainer */}

          <ViewHeaderProvider>
            <div className='AuthLayoutRouterCenterContainer flex flex-col h-full w-full'>
              <ViewHeader />
              <div className={cn(classes.center, { [classes.withoutNav]: withoutNav })} id={CENTER_COLUMN_ID}>
                {/* NOTE: It could be more clear to group the following switched routes by component  */}
                <Routes>
                  {/* **** Member Routes **** */}
                  <Route path='members/:personId/*' element={<MemberProfile isSingleColumn={isSingleColumn} />} />
                  <Route path='all/members/:personId/*' element={<MemberProfile />} />
                  {/* **** All and Public Routes **** */}
                  <Route path='all/stream/*' element={<Stream context='all' />} />
                  <Route path='public/stream/*' element={<Stream context='public' />} />
                  <Route path='all/projects/*' element={<Stream context='all' view='projects' />} />
                  <Route path='public/projects/*' element={<Stream context='public' view='projects' />} />
                  <Route path='all/decisions/*' element={<Stream context='all' view='decisions' />} />
                  <Route path='public/decisions/*' element={<Stream context='public' view='decisions' />} />
                  <Route path='all/events/*' element={<Stream context='all' />} />
                  <Route path='public/events/*' element={<Stream context='public' />} />
                  <Route path='all/map/*' element={<MapExplorer context='all' />} />
                  <Route path='public/map/*' element={<MapExplorer context='public' />} />
                  <Route path='public/groups/*' element={<GroupExplorer />} />
                  <Route path='all/topics/:topicName' element={<Stream context='all' />} />
                  <Route path='public/topics/:topicName' element={<Stream context='public' />} />
                  <Route path='all/topics' element={<AllTopics />} />
                  <Route path='all/*' element={returnDefaultView(false, 'all')} />
                  <Route path='public/*' element={returnDefaultView(false, 'public')} />
                  {/* **** Group Routes **** */}
                  <Route path='create-group/*' element={<CreateGroup />} />
                  <Route path='groups/:joinGroupSlug/join/:accessCode' element={<JoinGroup />} />
                  <Route path='h/use-invitation' element={<JoinGroup />} />
                  {currentGroupLoading && (
                    <Route path='groups/:groupSlug' element={<Loading />} />
                  )}
                  {/* When viewing a group you are not a member of show group detail page */}
                  {currentGroupSlug && !currentGroupMembership && (
                    <Route path='groups/:groupSlug' element={<GroupDetail context='groups' group={currentGroup} />} />
                  )}
                  <Route path='groups/:groupSlug/about/*' element={<GroupDetail context='groups' />} />
                  <Route path='groups/:groupSlug/map/*' element={<MapExplorer context='groups' view='map' />} />
                  <Route path='groups/:groupSlug/stream/*' element={<Stream context='groups' view='stream' />} />
                  <Route path='groups/:groupSlug/decisions/*' element={<Stream context='groups' view='decisions' />} />
                  <Route path='groups/:groupSlug/explore/*' element={<LandingPage context='groups' />} />
                  <Route path='groups/:groupSlug/ask-and-offer/*' element={<Stream context='groups' view='ask-and-offer' />} />
                  <Route path='groups/:groupSlug/discussions/*' element={<Stream context='groups' view='discussions' />} />
                  <Route path='groups/:groupSlug/events/*' element={<Stream context='groups' view='events' />} />
                  <Route path='groups/:groupSlug/resources/*' element={<Stream context='groups' view='resources' />} />
                  <Route path='groups/:groupSlug/projects/*' element={<Stream context='groups' view='projects' />} />
                  <Route path='groups/:groupSlug/custom/:customViewId/*' element={<Stream context='groups' view='custom' />} />
                  <Route path='groups/:groupSlug/groups/*' element={<Groups context='groups' />} />
                  <Route path='groups/:groupSlug/members/create/*' element={<Members context='groups' />} />
                  <Route path='groups/:groupSlug/members/:personId/*' element={<MemberProfile context='groups' />} />
                  <Route path='groups/:groupSlug/members/*' element={<Members context='groups' />} />
                  <Route path='groups/:groupSlug/topics/:topicName/*' element={<Stream context='groups' />} />
                  <Route path='groups/:groupSlug/topics' element={<AllTopics context='groups' />} />
                  <Route path='groups/:groupSlug/chat/:topicName/*' element={<ChatRoom context='groups' />} />
                  <Route path='groups/:groupSlug/settings/*' element={<GroupSettings context='groups' />} />
                  <Route path='groups/:groupSlug/all-views' element={<AllView context='groups' />} />
                  <Route path='groups/:groupSlug/*' element={homeRoute} />
                  <Route path='post/:postId/*' element={<PostDetail />} />
                  {/* **** My Routes **** */}
                  <Route path='my/posts/*' element={<Stream context='my' view='posts' />} />
                  <Route path='my/interactions/*' element={<Stream context='my' view='interactions' />} />
                  <Route path='my/announcements/*' element={<Stream context='my' view='announcements' />} />
                  <Route path='my/mentions/*' element={<Stream context='my' view='mentions' />} />
                  <Route path='my/*' element={<UserSettings />} />
                  <Route path='my' element={<Navigate to='/my/posts' replace />} />
                  {/* **** Other Routes **** */}
                  <Route path='welcome/*' element={<WelcomeWizardRouter />} />
                  <Route path='messages/:messageThreadId' element={<Messages />} />
                  <Route path='messages' element={<Loading />} />
                  {/* Keep old settings paths for mobile */}
                  <Route path='settings/*' element={<UserSettings />} />
                  <Route path='search' element={<Search />} />
                  <Route path='notifications' /> {/* XXX: hack because if i dont have this the default route overrides the redirect to /my/notifications above */}
                  {/* **** Default Route (404) **** */}
                  <Route path='*' element={<Navigate to={lastViewedGroup ? `/groups/${lastViewedGroup.slug}` : '/all'} replace />} />
                </Routes>
              </div>

              <div className={cn(classes.detail, { [classes.hidden]: !hasDetail })} id={DETAIL_COLUMN_ID}>
                <Routes>
                  {/* All context routes */}
                  <Route path={`/all/explore/${POST_DETAIL_MATCH}`} element={<PostDetail context='all' />} />
                  <Route path={`/all/groups/${POST_DETAIL_MATCH}`} element={<PostDetail context='all' />} />
                  <Route path={`/all/map/${POST_DETAIL_MATCH}`} element={<PostDetail context='all' />} />
                  <Route path={`/all/map/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='all' />} />

                  {/* Public context routes */}
                  <Route path={`/public/explore/${POST_DETAIL_MATCH}`} element={<PostDetail context='public' />} />
                  <Route path={`/public/groups/${POST_DETAIL_MATCH}`} element={<PostDetail context='public' />} />
                  <Route path={`/public/map/${POST_DETAIL_MATCH}`} element={<PostDetail context='public' />} />
                  <Route path={`/public/map/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='public' />} />
                  <Route path={`/public/groups/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='public' />} />

                  {/* My context routes */}
                  {/* <Route path={`/my/mentions/${POST_DETAIL_MATCH}`} element={<PostDetail context='my' />} />
                  <Route path={`/my/interactions/${POST_DETAIL_MATCH}`} element={<PostDetail context='my' />} />
                  <Route path={`/my/posts/${POST_DETAIL_MATCH}`} element={<PostDetail context='my' />} />
                  <Route path={`/my/announcements/${POST_DETAIL_MATCH}`} element={<PostDetail context='my' />} /> */}

                  {/* Groups context routes */}
                  <Route path={`/groups/:groupSlug/explore/${POST_DETAIL_MATCH}`} element={<PostDetail context='groups' />} />
                  <Route path={`/groups/:groupSlug/map/${POST_DETAIL_MATCH}`} element={<PostDetail context='groups' />} />
                  <Route path={`/groups/:groupSlug/custom/:customViewId/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />
                  <Route path={`/groups/:groupSlug/explore/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />
                  <Route path={`/groups/:groupSlug/groups/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />
                  <Route path={`/groups/:groupSlug/map/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />
                  <Route path={`/groups/:groupSlug/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />

                  {/* Other routes */}
                  <Route path={`/members/:personId/${POST_DETAIL_MATCH}`} element={<PostDetail />} />
                </Routes>
              </div>
              <SocketListener location={location} groupSlug={currentGroupSlug} />
              <SocketSubscriber type='group' id={get('slug', currentGroup)} />
            </div>
          </ViewHeaderProvider>
        </div>
      </Div100vh>
    </IntercomProvider>
  )
}

function returnDefaultView (group, context) {
  if (!group) return <Stream context={context} />

  switch (group.type) {
    case GROUP_TYPES.farm:
      return <LandingPage />
    default:
      return <Stream context='groups' />
  }
}

function getHomeUrl ({ group, routeParams }) {
  return widgetUrl({ ...routeParams, widget: findHomeWidget(group) })
}
