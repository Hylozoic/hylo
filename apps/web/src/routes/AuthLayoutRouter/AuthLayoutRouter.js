import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { matchPath, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { IntercomProvider } from 'react-use-intercom'
import { Helmet } from 'react-helmet'
import { get, some } from 'lodash/fp'
import { cn } from 'util/index'
import mixpanel from 'mixpanel-browser'
import config, { isTest } from 'config/index'
import CookieConsentLinker from 'components/CookieConsentLinker'
import ContextMenu from './components/ContextMenu'
import CreateModal from 'components/CreateModal'
import GlobalNav from './components/GlobalNav'
import NotFound from 'components/NotFound'
import SocketListener from 'components/SocketListener'
import SocketSubscriber from 'components/SocketSubscriber'
import { useLayoutFlags } from 'contexts/LayoutFlagsContext'
import ViewHeader from 'components/ViewHeader'
import getReturnToPath from 'store/selectors/getReturnToPath'
import setReturnToPath from 'store/actions/setReturnToPath'
import fetchCommonRoles from 'store/actions/fetchCommonRoles'
import fetchForCurrentUser from 'store/actions/fetchForCurrentUser'
import fetchForGroup from 'store/actions/fetchForGroup'
import fetchThreads from 'store/actions/fetchThreads'
import getMe from 'store/selectors/getMe'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getMyGroupMembership from 'store/selectors/getMyGroupMembership'
import { getSignupInProgress } from 'store/selectors/getAuthState'
import getLastViewedGroup from 'store/selectors/getLastViewedGroup'
import {
  POST_DETAIL_MATCH, GROUP_DETAIL_MATCH, postUrl,
  groupHomeUrl
} from '@hylo/navigation'
import { CENTER_COLUMN_ID, DETAIL_COLUMN_ID } from 'util/scrolling'
import Loading from 'components/Loading'
import { GROUP_TYPES } from 'store/models/Group'
import { getLocaleFromLocalStorage } from 'util/locale'
import isWebView from 'util/webView'
import { setMembershipLastViewedAt } from './AuthLayoutRouter.store'
import classes from './AuthLayoutRouter.module.scss'

// Lazy load routes to reduce initial bundle size
const AllTopics = React.lazy(() => import('routes/AllTopics'))
const AllView = React.lazy(() => import('routes/AllView'))
const ChatRoom = React.lazy(() => import('routes/ChatRoom'))
const CreateGroup = React.lazy(() => import('routes/CreateGroup'))
const GroupDetail = React.lazy(() => import('routes/GroupDetail'))
const GroupSettings = React.lazy(() => import('routes/GroupSettings'))
const GroupWelcomeModal = React.lazy(() => import('routes/GroupWelcomeModal'))
const GroupWelcomePage = React.lazy(() => import('routes/GroupWelcomePage'))
const Groups = React.lazy(() => import('routes/Groups'))
const GroupExplorer = React.lazy(() => import('routes/GroupExplorer'))
const Drawer = React.lazy(() => import('./components/Drawer'))
const JoinGroup = React.lazy(() => import('routes/JoinGroup'))
const LandingPage = React.lazy(() => import('routes/LandingPage'))
const MapExplorer = React.lazy(() => import('routes/MapExplorer'))
const MemberProfile = React.lazy(() => import('routes/MemberProfile'))
const Members = React.lazy(() => import('routes/Members'))
const Messages = React.lazy(() => import('routes/Messages'))
const ThreadList = React.lazy(() => import('routes/Messages/ThreadList'))
const Moderation = React.lazy(() => import('routes/Moderation'))
const MyTracks = React.lazy(() => import('routes/MyTracks'))
const PostDetail = React.lazy(() => import('routes/PostDetail'))
const Search = React.lazy(() => import('routes/Search'))
const Stream = React.lazy(() => import('routes/Stream'))
const Themes = React.lazy(() => import('routes/Themes'))
const TrackHome = React.lazy(() => import('routes/TrackHome'))
const Tracks = React.lazy(() => import('routes/Tracks'))
const UserSettings = React.lazy(() => import('routes/UserSettings'))
const WelcomeWizardRouter = React.lazy(() => import('routes/WelcomeWizardRouter'))

export default function AuthLayoutRouter (props) {
  const resizeRef = useRef()
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
    // TODO: fix this hacky way to determine whether to open up the detail pane
    const detailRegex = /\/(group|post)\/([a-zA-Z0-9-]+)/
    return detailRegex.test(location.pathname) && (location.pathname.includes('map/') || location.pathname.includes('groups/group'))
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

  // Track group loading to prevent NotFound flash
  const [currentGroupLoading, setCurrentGroupLoading] = useState(false)
  const [hasAttemptedGroupLoad, setHasAttemptedGroupLoad] = useState(false)

  // Optimistic rendering: don't block if we already have user data from checkLogin
  // Fetch fresh data in background to keep state current
  useEffect(() => {
    // Fire-and-forget background refresh (don't await, don't block rendering)
    Promise.all([
      dispatch(fetchCommonRoles()),
      dispatch(fetchForCurrentUser())
    ]).then(() => {
      // Defer non-critical data until after critical data loads
      dispatch(fetchThreads())
    })
  }, [])

  useEffect(() => {
    if (currentUser?.id && mixpanel && typeof mixpanel.identify === 'function') {
      mixpanel.identify(currentUser.id)
      mixpanel.people.set({
        $name: currentUser.name,
        $email: currentUser.email,
        $location: currentUser.location
      })

      if (currentUser?.settings?.locale) getLocaleFromLocalStorage(currentUser?.settings?.locale)
    }
  }, [currentUser?.email, currentUser?.id, currentUser?.location, currentUser?.name, currentUser?.settings?.locale])

  useEffect(() => {
    // Add all current group membershps to mixpanel user (only if mixpanel is loaded)
    if (mixpanel && typeof mixpanel.set_group === 'function') {
      mixpanel.set_group('groupId', memberships.map(m => m.group.id))

      if (currentGroup?.id) {
        // Setup group profile info
        mixpanel.get_group('groupId', currentGroup.id).set({
          $location: currentGroup.location,
          $name: currentGroup.name,
          type: currentGroup.type
        })
      }
    }
  }, [currentGroup?.id, currentGroup?.location, currentGroup?.name, currentGroup?.type, memberships])

  useEffect(() => {
    (async function () {
      if (currentGroupSlug) {
        setCurrentGroupLoading(true)
        setHasAttemptedGroupLoad(true)
        await dispatch(fetchForGroup(currentGroupSlug))
        setCurrentGroupLoading(false)
      } else {
        // Reset when navigating away from a group
        setHasAttemptedGroupLoad(false)
      }
    })()
  }, [currentGroupSlug])

  // Scroll to top of center column when context, groupSlug, or view changes (from `pathMatchParams`)
  useEffect(() => {
    const centerColumn = document.getElementById(CENTER_COLUMN_ID)
    if (centerColumn) centerColumn.scrollTop = 0
  }, [pathMatchParams?.context, pathMatchParams?.groupSlug, pathMatchParams?.view])

  // Optimistic rendering: only show loading if we don't have user data yet
  // checkLogin() should have populated currentUser, so we can render immediately
  if (!currentUser) {
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
  const showMenuBadge = some(m => m.newPostCount > 0, memberships)

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
    const lastViewedAt = (new Date()).toISOString()
    dispatch(setMembershipLastViewedAt(currentGroup.id, currentUser.id, lastViewedAt))
    if (currentGroup?.settings?.showWelcomePage) {
      navigate(`/groups/${currentGroupSlug}/welcome`, { replace: true })
    } else {
      navigate(groupHomeUrl({ routeParams: pathMatchParams, group: currentGroup }), { replace: true })
    }
  }

  // Only show NotFound if we've actually attempted to load the group and it doesn't exist
  // This prevents the NotFound flash during optimistic rendering
  if (currentGroupSlug && !currentGroup && !currentGroupLoading && hasAttemptedGroupLoad) {
    return <NotFound />
  }

  const homeRoute = currentGroup?.contextWidgets?.items?.length > 0 ? <Navigate to={groupHomeUrl({ routeParams: pathMatchParams, group: currentGroup })} replace /> : returnDefaultView(currentGroup, 'groups')

  return (
    <IntercomProvider appId={isTest ? '' : config.intercom.appId} autoBoot autoBootProps={intercomProps}>
      <Helmet>
        <title>{currentGroup ? `${currentGroup.name} | ` : ''}Hylo</title>
        <meta name='description' content='Prosocial Coordination for a Thriving Planet' />
        <script id='greencheck' type='application/json'>
          {`{ 'id': '${currentUser.id}', 'fullname': '${currentUser.name}', 'description': '${currentUser.tagline}', 'image': '${currentUser.avatarUrl}' }`}
        </script>
      </Helmet>

      <Suspense fallback={null}>
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
            </>
          )}
        </Routes>
      </Suspense>

      <div className={cn('flex flex-row items-stretch bg-midground h-[100vh] h-[100dvh]', { [classes.mapView]: isMapView, [classes.detailOpen]: hasDetail })}>
        <div ref={resizeRef} className={cn(classes.main, { [classes.mapView]: isMapView, [classes.withoutNav]: withoutNav, [classes.mainPad]: !withoutNav })}>
          <div className={cn('AuthLayoutRouterNavContainer hidden sm:flex flex-row max-w-420 h-full z-50', { 'flex absolute sm:relative': isNavOpen })}>
            {!withoutNav && (
              <>
                <GlobalNav
                  group={currentGroup}
                  currentUser={currentUser}
                  routeParams={pathMatchParams}
                  showMenuBadge={showMenuBadge}
                />
                {isDrawerOpen && (
                  <Suspense fallback={<Loading />}>
                    <Drawer className={cn(classes.drawer)} group={currentGroup} context={pathMatchParams?.context} />
                  </Suspense>
                )}
              </>
            )}

            {(!currentGroupSlug || (currentGroup && currentGroupMembership)) &&
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path='public/*' element={<ContextMenu context={pathMatchParams?.context} currentGroup={currentGroup} mapView={isMapView} />} />
                  <Route path='my/*' element={<ContextMenu context={pathMatchParams?.context} currentGroup={currentGroup} mapView={isMapView} />} />
                  <Route path='all/*' element={<ContextMenu context={pathMatchParams?.context} currentGroup={currentGroup} mapView={isMapView} />} />
                  <Route path='groups/:joinGroupSlug/join/:accessCode' />
                  <Route path='groups/:groupSlug/*' element={<ContextMenu context={pathMatchParams?.context} currentGroup={currentGroup} mapView={isMapView} />} />
                  <Route path='messages/:messageThreadId' element={<ThreadList />} />
                  <Route path='messages' element={<ThreadList />} />
                </Routes>
              </Suspense>}
          </div> {/* END NavContainer */}

          <div className='AuthLayoutRouterCenterContainer flex flex-col h-full w-full relative'>
            <ViewHeader />

            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path='groups/:groupSlug/topics/:topicName/create/*' element={<CreateModal context='groups' />} />
                <Route path='groups/:groupSlug/topics/:topicName/post/:postId/create/*' element={<CreateModal context='groups' />} />
                <Route path='groups/:groupSlug/topics/:topicName/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
                <Route path='groups/:groupSlug/chat/:topicName/create/*' element={<CreateModal context='groups' />} />
                <Route path='groups/:groupSlug/chat/:topicName/post/:postId/create/*' element={<CreateModal context='groups' />} />
                <Route path='groups/:groupSlug/chat/:topicName/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
                <Route path='groups/:groupSlug/members/:personId/create/*' element={<CreateModal context='groups' />} />
                <Route path='groups/:groupSlug/tracks/:trackId/create/*' element={<CreateModal context='groups' />} />
                <Route path='groups/:groupSlug/tracks/:trackId/edit/*' element={<CreateModal context='groups' editingTrack />} />
                <Route path='groups/:groupSlug/tracks/:trackId/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
                <Route path='groups/:groupSlug/settings/:tab/create/*' element={<CreateModal context='groups' />} />
                <Route path='groups/:groupSlug/:view/create/*' element={<CreateModal context='groups' />} />
                <Route path='groups/:groupSlug/custom/:customViewId/create/*' element={<CreateModal context='groups' />} />
                <Route path='groups/:groupSlug/custom/:customViewId/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
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
                <Route path='post/:postId/create/*' element={<CreateModal context='all' />} />
                <Route path='post/:postId/edit/*' element={<CreateModal context='all' editingPost />} />
              </Routes>
            </Suspense>

            <div className={cn('AuthLayout_centerColumn px-0 sm:px-2 relative min-h-1 h-full flex-1 overflow-y-auto overflow-x-hidden transition-all duration-450', { 'z-[60]': withoutNav, 'sm:p-0': isMapView })} id={CENTER_COLUMN_ID}>
              {/* NOTE: It could be more clear to group the following switched routes by component  */}
              <Suspense fallback={<Loading />}>
                <Routes>
                  {/* **** Member Routes **** */}
                  <Route path='members/:personId/*' element={<MemberProfile />} />
                  <Route path='all/members/:personId/*' element={<MemberProfile />} />
                  {/* **** All and Public Routes **** */}
                  <Route path='all/stream/*' element={<Stream context='all' />} />
                  <Route path='public/stream/*' element={<Stream context='public' />} />
                  <Route path='all/projects/*' element={<Stream context='all' view='projects' />} />
                  <Route path='public/projects/*' element={<Stream context='public' view='projects' />} />
                  <Route path='all/proposals/*' element={<Stream context='all' view='proposals' />} />
                  <Route path='public/proposals/*' element={<Stream context='public' view='proposals' />} />
                  <Route path='all/events/*' element={<Stream context='all' />} />
                  <Route path='public/events/*' element={<Stream context='public' />} />
                  <Route path='all/map/*' element={<MapExplorer context='all' />} />
                  <Route path='public/map/*' element={<MapExplorer context='public' />} />
                  <Route path='public/groups/*' element={<GroupExplorer />} />
                  <Route path='all/topics/:topicName' element={<Stream context='all' />} />
                  <Route path='public/topics/:topicName' element={<Stream context='public' />} />
                  <Route path='all/topics' element={<AllTopics />} />
                  <Route path='all/*' element={<Stream context='my' />} />
                  <Route path='public/*' element={<Navigate to='/public/stream' replace />} />
                  {/* **** Group Routes **** */}
                  <Route path='create-group/*' element={<CreateGroup />} />
                  <Route path='groups/:joinGroupSlug/join/:accessCode' element={<JoinGroup />} />
                  <Route path='h/use-invitation' element={<JoinGroup />} />
                  {currentGroupLoading && (
                    <Route path='groups/:groupSlug/*' element={<Loading />} />
                  )}
                  <Route
                    path='groups/:groupSlug/*'
                    element={
                      /* When viewing a group, check membership first before rendering any group routes */
                      currentGroupLoading
                        ? <Loading />
                        : currentGroupSlug && !currentGroupMembership
                          ? <GroupDetail context='groups' group={currentGroup} />
                          : (
                            <Routes>
                              <Route path='about/*' element={<GroupDetail context='groups' forCurrentGroup />} />
                              <Route path='welcome/*' element={<GroupWelcomePage />} />
                              <Route path='map/*' element={<MapExplorer context='groups' view='map' />} />
                              <Route path='stream/*' element={<Stream context='groups' view='stream' />} />
                              <Route path='discussions/*' element={<Stream context='groups' view='discussions' />} />
                              <Route path='events/*' element={<Stream context='groups' view='events' />} />
                              <Route path='resources/*' element={<Stream context='groups' view='resources' />} />
                              <Route path='projects/*' element={<Stream context='groups' view='projects' />} />
                              <Route path='proposals/*' element={<Stream context='groups' view='proposals' />} />
                              <Route path='requests-and-offers/*' element={<Stream context='groups' view='requests-and-offers' />} />
                              <Route path='explore/*' element={<LandingPage />} />
                              <Route path='custom/:customViewId/*' element={<Stream context='groups' view='custom' />} />
                              <Route path='groups/*' element={<Groups context='groups' />} />
                              <Route path='members/create/*' element={<Members context='groups' />} />
                              <Route path='members/:personId/*' element={<MemberProfile context='groups' />} />
                              <Route path='members/*' element={<Members context='groups' />} />
                              <Route path='topics/:topicName/*' element={<Stream context='groups' />} />
                              <Route path='topics' element={<AllTopics context='groups' />} />
                              <Route path='tracks/:trackId/*' element={<TrackHome />} />
                              <Route path='tracks/*' element={<Tracks />} />
                              <Route path='chat/:topicName/*' element={<ChatRoom context='groups' />} />
                              <Route path='settings/*' element={<GroupSettings context='groups' />} />
                              <Route path='all-views' element={<AllView context='groups' />} />
                              <Route path={POST_DETAIL_MATCH} element={<PostDetail />} />
                              <Route path='moderation/*' element={<Moderation context='groups' />} />
                              <Route path='*' element={homeRoute} />
                            </Routes>
                            )
                      }
                  />
                  {/* **** My Routes **** */}
                  <Route path='my/posts/*' element={<Stream context='my' view='posts' />} />
                  <Route path='my/interactions/*' element={<Stream context='my' view='interactions' />} />
                  <Route path='my/announcements/*' element={<Stream context='my' view='announcements' />} />
                  <Route path='my/mentions/*' element={<Stream context='my' view='mentions' />} />
                  <Route path='my/saved-posts/*' element={<Stream context='my' view='saved-posts' />} />
                  <Route path='my/tracks/*' element={<MyTracks />} />
                  <Route path='my/*' element={<UserSettings />} />
                  <Route path='my' element={<Navigate to='/my/posts' replace />} />
                  {/* **** Other Routes **** */}
                  <Route path='welcome/*' element={<WelcomeWizardRouter />} />
                  <Route path='messages/:messageThreadId' element={<Messages />} />
                  <Route path='messages' element={<Loading />} />
                  <Route path='post/:postId/*' element={<PostDetail />} />
                  {/* Keep old settings paths for mobile */}
                  <Route path='settings/*' element={<UserSettings />} />
                  <Route path='search' element={<Search />} />
                  <Route path='themes' element={<Themes />} />
                  <Route path='notifications' /> {/* XXX: hack because if i dont have this the default route overrides the redirect to /my/notifications above */}
                  {/* **** Default Route (404) **** */}
                  <Route path='*' element={<Navigate to={lastViewedGroup ? `/groups/${lastViewedGroup.slug}` : '/all'} replace />} />
                </Routes>
              </Suspense>
            </div>

            <div className={cn('bg-midground/100 shadow-lg', classes.detail, { [classes.hidden]: !hasDetail })} id={DETAIL_COLUMN_ID}>
              <Suspense fallback={<Loading />}>
                <Routes>
                      {/* All context routes */}
                      <Route path={`/all/groups/${POST_DETAIL_MATCH}`} element={<PostDetail context='all' />} />
                      <Route path={`/all/map/${POST_DETAIL_MATCH}`} element={<PostDetail context='all' />} />
                      <Route path={`/all/map/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='all' />} />

                      {/* Public context routes */}
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
                      <Route path={`/groups/:groupSlug/map/${POST_DETAIL_MATCH}`} element={<PostDetail context='groups' />} />
                      <Route path={`/groups/:groupSlug/custom/:customViewId/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />
                      <Route path={`/groups/:groupSlug/groups/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />
                      <Route path={`/groups/:groupSlug/map/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />
                      <Route path={`/groups/:groupSlug/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />

                      {/* Other routes */}
                      <Route path={`/members/:personId/${POST_DETAIL_MATCH}`} element={<PostDetail />} />
                    </Routes>
              </Suspense>
            </div>
            <SocketListener location={location} groupSlug={currentGroupSlug} />
            <SocketSubscriber type='group' id={get('slug', currentGroup)} />
          </div>
        </div>
        <CookieConsentLinker />
      </div>
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
