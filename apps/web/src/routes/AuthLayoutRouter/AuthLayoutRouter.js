import React, { useEffect, useMemo, useRef, useState } from 'react'
import { matchPath, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { IntercomProvider } from 'react-use-intercom'
import { Helmet } from 'react-helmet'
import Div100vh from 'react-div-100vh'
import { useTranslation, Trans } from 'react-i18next'
import { get, some } from 'lodash/fp'
import { cn } from 'util/index'
import mixpanel from 'mixpanel-browser'
import config, { isTest } from 'config/index'
import ContextMenu from './components/ContextMenu'
import CreateModal from 'components/CreateModal'
import GlobalAlert from 'components/GlobalAlert'
import GlobalNav from './components/GlobalNav'
import NotFound from 'components/NotFound'
import SocketListener from 'components/SocketListener'
import SocketSubscriber from 'components/SocketSubscriber'
import Button from 'components/ui/button'
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
import JoinGroup from 'routes/JoinGroup'
import LandingPage from 'routes/LandingPage'
import Loading from 'components/Loading'
import MapExplorer from 'routes/MapExplorer'
import MemberProfile from 'routes/MemberProfile'
import Members from 'routes/Members'
import Messages from 'routes/Messages'
import ThreadList from 'routes/Messages/ThreadList'
import Moderation from 'routes/Moderation'
import MyTracks from 'routes/MyTracks'
import PostDetail from 'routes/PostDetail'
import Search from 'routes/Search'
import Stream from 'routes/Stream'
import TrackHome from 'routes/TrackHome'
import Tracks from 'routes/Tracks'
import UserSettings from 'routes/UserSettings'
import WelcomeWizardRouter from 'routes/WelcomeWizardRouter'
import { GROUP_TYPES } from 'store/models/Group'
import { localeLocalStorageSync } from 'util/locale'
import isWebView from 'util/webView'

import classes from './AuthLayoutRouter.module.scss'

export default function AuthLayoutRouter (props) {
  const resizeRef = useRef()
  const navigate = useNavigate()
  const { hideNavLayout } = useLayoutFlags()
  const withoutNav = isWebView() || hideNavLayout
  const { t } = useTranslation()

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

  const [currentUserLoading, setCurrentUserLoading] = useState(true)
  const [currentGroupLoading, setCurrentGroupLoading] = useState()

  useEffect(() => {
    (async function () {
      await dispatch(fetchCommonRoles())
      await dispatch(fetchForCurrentUser())
      setCurrentUserLoading(false)
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
  const showMenuBadge = some(m => m.newPostCount > 0, memberships)

  if (!signupInProgress && returnToPath) {
    const returnToPathName = new URL(returnToPath, 'https://hylo.com')?.pathname
    if (location.pathname + location.search === returnToPathName) {
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
      navigate(`/groups/${currentGroupSlug}/welcome`, { replace: true })
    } else {
      navigate(groupHomeUrl({ routeParams: pathMatchParams, group: currentGroup }), { replace: true })
    }
  }

  if (currentGroupSlug && !currentGroup && !currentGroupLoading) {
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

      {!isWebView() && new Date(currentUser.createdAt) < new Date('2025-03-15') && !window.localStorage.getItem('new-hylo-alert-seen') && (
        <GlobalAlert
          title={t('Welcome to the new Hylo!')}
          onOpenChange={(open) => {
            if (!open) {
              window.localStorage.setItem('new-hylo-alert-seen', true)
            }
          }}
          closeButton={<Button variant='secondary'>{t('Jump in!')}</Button>}
        >
          <div>
            <Trans i18nKey='newHyloMessage'>
              We just launched a major redesign of Hylo! To learn more about what's new, <a href='https://hylozoic.gitbook.io/hylo/product/hylo-redesign-product-updates' target='_blank' rel='noreferrer'>click here</a>.
            </Trans>
          </div>
        </GlobalAlert>
      )}

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

      <Div100vh className={cn('flex flex-row items-stretch bg-midground', { [classes.mapView]: isMapView, [classes.detailOpen]: hasDetail })}>
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

          <div className='AuthLayoutRouterCenterContainer flex flex-col h-full w-full relative'>
            <ViewHeader />

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

            <div className={cn(classes.center, { [classes.withoutNav]: withoutNav })} id={CENTER_COLUMN_ID}>
              {/* NOTE: It could be more clear to group the following switched routes by component  */}
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
                <Route path='my/tracks/*' element={<MyTracks />} />
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
            </div>
            <SocketListener location={location} groupSlug={currentGroupSlug} />
            <SocketSubscriber type='group' id={get('slug', currentGroup)} />
          </div>
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
