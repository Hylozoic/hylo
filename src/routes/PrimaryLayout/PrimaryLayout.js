import cx from 'classnames'
import { get, some } from 'lodash/fp'
import qs from 'querystring'
import React, { Component } from 'react'
import Intercom from 'react-intercom'
import Joyride from 'react-joyride'
import {
  matchPath,
  Redirect,
  Route,
  Switch
} from 'react-router-dom'

import config, { isTest } from 'config'
import Div100vh from 'react-div-100vh'
import AddLocation from 'routes/Signup/AddLocation'
import AllTopics from 'routes/AllTopics'
import CreateModal from 'components/CreateModal'
import GroupDetail from 'routes/GroupDetail'
import GroupSettings from 'routes/GroupSettings'
import GroupSidebar from 'routes/GroupSidebar'
import Groups from 'routes/Groups'
import Drawer from './components/Drawer'
import Feed from 'routes/Feed'
import MapExplorer from 'routes/MapExplorer'
import Loading from 'components/Loading'
import MemberProfile from 'routes/MemberProfile'
// import MemberSidebar from 'routes/MemberSidebar'
import Members from 'routes/Members'
import Messages from 'routes/Messages'
import Navigation from './components/Navigation'
import NotFound from 'components/NotFound'
import PostDetail from 'routes/PostDetail'
import PostEditorModal from 'components/PostEditorModal'
import Welcome from 'routes/Signup/Welcome'
import Search from 'routes/Search'
import SignupModal from 'routes/Signup/SignupModal'
import SocketListener from 'components/SocketListener'
import SocketSubscriber from 'components/SocketSubscriber'
import TopNav from './components/TopNav'
import UploadPhoto from 'routes/Signup/UploadPhoto'
import UserSettings from 'routes/UserSettings'
import {
  OPTIONAL_POST_MATCH, OPTIONAL_GROUP_MATCH,
  OPTIONAL_NEW_POST_MATCH, POST_DETAIL_MATCH, GROUP_DETAIL_MATCH,
  REQUIRED_EDIT_POST_MATCH,
  isSignupPath,
  isMapViewPath
} from 'util/navigation'
import { CENTER_COLUMN_ID, DETAIL_COLUMN_ID } from 'util/scrolling'
import './PrimaryLayout.scss'

// In order of more specific to less specific
const routesWithDrawer = [
  { path: `/:context(all|public)/:view(events|map|projects)/${OPTIONAL_POST_MATCH}` },
  { path: `/:context(all|public)/:view(map)/${OPTIONAL_GROUP_MATCH}` },
  { path: `/:context(all|public)/${OPTIONAL_POST_MATCH}` },
  { path: '/:context(all)/:view(topics)/:topicName' },
  { path: '/:context(all)/:view(topics)' },
  // {/* Group Routes */}
  { path: `/:context(groups)/:groupSlug/:view(members)/:personId/${OPTIONAL_POST_MATCH}` },
  { path: `/:context(groups)/:groupSlug/:view(topics)/:topicName/${OPTIONAL_POST_MATCH}` },
  { path: `/:context(groups)/:groupSlug/:view(map)/${OPTIONAL_GROUP_MATCH}` },
  { path: `/:context(groups)/:groupSlug/:view(events|groups|map|members|projects|settings|topics)/${OPTIONAL_POST_MATCH}` },
  { path: `/:context(groups)/:groupSlug/${OPTIONAL_POST_MATCH}` },
  // {/* Member Routes */}
  { path: `/:view(members)/:personId/${OPTIONAL_POST_MATCH}` },
  // {/* Other Routes */}
  { path: '/messages' },
  { path: '/settings' },
  { path: '/search' },
  { path: '/confirm-group-delete' }
]

const detailRoutes = [
  { path: `/:context(all|public)/:view(events|map|projects)/${POST_DETAIL_MATCH}`, component: PostDetail },
  { path: `/:context(all|public)/:view(map)/${GROUP_DETAIL_MATCH}`, component: GroupDetail },
  { path: `/:context(all)/:view(members)/:personId/${POST_DETAIL_MATCH}`, component: PostDetail },
  { path: `/:context(all|public)/${POST_DETAIL_MATCH}`, component: PostDetail },
  { path: `/:context(groups)/:groupSlug/:view(map|events|projects)/${POST_DETAIL_MATCH}`, component: PostDetail },
  { path: `/:context(groups)/:groupSlug/:view(members)/:personId/${POST_DETAIL_MATCH}`, component: PostDetail },
  { path: `/:context(groups)/:groupSlug/:view(map|groups)/${GROUP_DETAIL_MATCH}`, component: GroupDetail },
  { path: `/:context(groups)/:groupSlug/:view(topics)/:topicName/${POST_DETAIL_MATCH}`, component: PostDetail },
  { path: `/:context(groups)/:groupSlug/${POST_DETAIL_MATCH}`, component: PostDetail },
  { path: `/:view(members)/:personId/${POST_DETAIL_MATCH}`, component: PostDetail }
]

const createRoutes = [
  { path: `/:context(all|public)/:view(events|groups|map|projects)/${OPTIONAL_POST_MATCH}` },
  { path: `/:context(all|public)/:view(members)/:personId/${OPTIONAL_POST_MATCH}` },
  { path: `/:context(all|public)/:views(topics)/:topicName/${OPTIONAL_POST_MATCH}` },
  { path: `/:context(all|public)/${OPTIONAL_POST_MATCH}` },
  { path: `/:context(groups)/:groupSlug/:view(members)/:personId/${OPTIONAL_POST_MATCH}` },
  { path: `/:context(groups)/:groupSlug/:view(projects|events|groups|map|topics)/${OPTIONAL_POST_MATCH}` },
  { path: `/:context(groups)/:groupSlug/:view(topics)/:topicName/${OPTIONAL_POST_MATCH}` },
  { path: `/:context(groups)/:groupSlug/${OPTIONAL_POST_MATCH}` },
  { path: `/:view(members)/:personId/${OPTIONAL_POST_MATCH}` }
]

const signupRoutes = [
  { path: '/signup/upload-photo', child: UploadPhoto },
  { path: '/signup/add-location', child: AddLocation },
  { path: '/signup/welcome', child: Welcome }
]

const redirectRoutes = [
  // Redirects from old routes
  { from: '/:context(public|all)/p/:postId', to: '/:context/post/:postId' },
  { from: '/:context(public|all)/project', to: '/:context/projects' },
  { from: '/:context(public|all)/event', to: '/:context/events' },
  { from: '/p/:postId', to: '/all/post/:postId' },
  { from: '/m/:personId', to: '/all/members/:personId' },
  { from: '/m/:personId/p/:postId', to: '/all/members/:personId/post/:postId' },
  { from: '/all/m/:personId', to: '/all/members/:personId' },
  { from: '/all/m/:personId/p/:postId', to: '/all/members/:personId/post/:postId' },
  { from: '/(c|n)/:groupSlug/join/:accessCode', to: '/groups/:groupSlug/join/:accessCode' },
  { from: '/(c|n)/:groupSlug/', to: '/groups/:groupSlug/' },
  { from: '/(c|n)/:groupSlug/event', to: '/groups/:groupSlug/events' },
  { from: '/(c|n)/:groupSlug/event/:postId', to: '/groups/:groupSlug/events/post/:postId' },
  { from: '/(c|n)/:groupSlug/project', to: '/groups/:groupSlug/projects' },
  { from: '/(c|n)/:groupSlug/project/:postId', to: '/groups/:groupSlug/projects/post/:postId' },
  { from: '/(c|n)/:groupSlug/:view(members|map|settings|topics)', to: '/groups/:groupSlug/:view' },
  { from: '/(c|n)/:groupSlug/map/p/:postId', to: '/groups/:groupSlug/map/post/:postId' },
  { from: '/(c|n)/:groupSlug/p/:postId', to: '/groups/:groupSlug/post/:postId' },
  { from: '/(c|n)/:groupSlug/m/:personId', to: '/groups/:groupSlug/members/:personId' },
  { from: '/(c|n)/:groupSlug/m/:personId/p/:postId', to: '/groups/:groupSlug/members/:personId/post/:postId' },
  { from: '/(c|n)/:groupSlug/:topicName', to: '/groups/:groupSlug/topics/:topicName' },
  { from: '/(c|n)/:groupSlug/:topicName/p/:postId', to: '/groups/:groupSlug/topics/:topicName/post/:postId' },

  // redirects for context switching into global contexts, since these pages don't exist yet
  { from: '/all/(members|settings)', to: '/all' },
  { from: '/public/(members|topics|settings)', to: '/public' }
]

export default class PrimaryLayout extends Component {
  constructor (props) {
    super(props)
    this.state = {
      run: false,
      steps: [
        {
          disableBeacon: true,
          target: '#currentContext',
          title: 'You are here!',
          content: 'This is where we show you which group or view you are looking at. Hylo allows you to easily switch between groups as well as see updates from all your groups at once.'
        },
        {
          target: '#toggleDrawer',
          title: 'Switching groups & viewing all',
          content: 'By clicking on the group icon, you\'ll be able to switch between groups, or see all your groups at once.\n\nWant to see what else is out there? Navigate over to Public Groups & Posts to see!'
        },
        {
          target: '#groupMenu',
          title: 'Create & navigate',
          content: 'Here you can switch between types of content and create new content for people in your group or everyone on Hylo!'
        },
        {
          target: '#personalSettings',
          title: 'Messages, notifications & profile',
          content: 'Search for posts & people. Send messages to group members or people you see on Hylo. Stay up to date with current events and edit your profile.'
        }
      ],
      closeTheTour: false
    }
  }

  handleClickStartTour = (e) => {
    e.preventDefault()
    this.props.updateUserSettings({ settings: { alreadySeenTour: true } })
    this.setState({
      run: true,
      closeTheTour: true
    })
  }

  closeTour = () => {
    this.props.updateUserSettings({ settings: { alreadySeenTour: true } })
    this.setState({
      closeTheTour: true
    })
  }

  componentDidMount () {
    this.props.fetchForCurrentUser()
    if (this.props.slug) {
      this.props.fetchForGroup()
    }
  }

  componentDidUpdate (prevProps) {
    if (get('group.id', this.props) !== get('group.id', prevProps)) {
      this.props.fetchForGroup()
    }
  }

  render () {
    const {
      currentUser,
      group,
      groupPending,
      isDrawerOpen,
      isGroupMenuOpen,
      isGroupRoute,
      location,
      memberOfCurrentGroup,
      showLogoBadge,
      toggleDrawer
    } = this.props

    if (!currentUser) {
      return <div styleName='container'>
        <Loading type='loading-fullscreen' />
      </div>
    }

    if (isGroupRoute) {
      if (!group && !groupPending) return <NotFound />
    }

    const closeDrawer = () => isDrawerOpen && toggleDrawer()
    const queryParams = qs.parse(location.search.substring(1))
    const signupInProgress = get('settings.signupInProgress', currentUser)
    const showTourPrompt = !signupInProgress && !get('settings.alreadySeenTour', currentUser)
    const hasDetail = some(
      ({ path }) => matchPath(location.pathname, { path }),
      detailRoutes
    )
    const collapsedState = hasDetail || (isMapViewPath(location.pathname) && queryParams['hideDrawer'] !== 'true')
    const isSingleColumn = (group && !memberOfCurrentGroup) || matchPath(location.pathname, { path: '/members/:personId' })

    return <Div100vh styleName={cx('container', { 'map-view': isMapViewPath(location.pathname), 'singleColumn': isSingleColumn, 'detailOpen': hasDetail })}>
      { showTourPrompt ? <Route path='/:context(all|public|groups)' component={props =>
        <div styleName={cx('tourWrapper', { 'tourClosed': this.state.closeTheTour })}>
          <div styleName='tourPrompt'>
            <div styleName='tourGuide'><img src='/axolotl-tourguide.png' /></div>
            <div styleName='tourExplanation'>
              <p><strong>Welcome to Hylo {currentUser.name}!</strong> I’d love to show you how things work, would you like a quick tour?</p>
              <p>To follow the tour look for the pulsing beacons! <span styleName='beaconExample'><span styleName='beaconA' /><span styleName='beaconB' /></span></p>
              <div>
                <button styleName='skipTour' onClick={this.closeTour}>No thanks</button>
                <button styleName='startTour' onClick={this.handleClickStartTour}>Show me Hylo</button>
              </div>
              <div styleName='speechIndicator' />
            </div>
          </div>
          <div styleName='tourBg' onClick={this.closeTour} />
        </div>} />
        : ' '}

      {/* Context navigation drawer */}
      <Switch>
        {routesWithDrawer.map(({ path }) => (
          <Route path={path} key={path} render={props => (
            <Drawer {...props} styleName={cx('drawer', { hidden: !isDrawerOpen })} {...{ group }} />
          )} />
        ))}
      </Switch>

      <TopNav styleName='top' onClick={closeDrawer} {...{ group, currentUser, showLogoBadge }} />

      <div styleName={cx('main', { 'map-view': isMapViewPath(location.pathname) })} onClick={closeDrawer}>
        {/* View navigation menu */}
        <Route path='/:context(all|public)' component={props =>
          <Navigation {...props}
            collapsed={collapsedState}
            styleName={cx('left', { 'map-view': isMapViewPath(location.pathname) })}
            mapView={isMapViewPath(location.pathname)}
          />}
        />
        {group && memberOfCurrentGroup &&
          <Route path='/:context(groups)/:groupSlug' component={props =>
            <Navigation {...props}
              collapsed={collapsedState}
              styleName={cx('left', { 'map-view': isMapViewPath(location.pathname) }, { 'hidden': !isGroupMenuOpen })}
              mapView={isMapViewPath(location.pathname)}
            />}
          />
        }

        <Div100vh styleName={cx('center', { 'map-view': isMapViewPath(location.pathname) }, { collapsedState })} id={CENTER_COLUMN_ID}>
          <Switch>
            {redirectRoutes.map(({ from, to }) => <Redirect from={from} to={to} exact key={from} />)}
            {signupRoutes.map(({ path, child }) =>
              <Route path={path} key={path} render={props =>
                <SignupModal {...props} child={child} />} />)}
            {signupInProgress &&
              <RedirectToSignupFlow pathname={this.props.location.pathname} currentUser={currentUser} />}
            {!signupInProgress &&
              <RedirectToGroup path='/(|app)' currentUser={currentUser} />}
            {/* Member Routes */}
            <Route path={`/:view(members)/:personId/${OPTIONAL_POST_MATCH}`} render={props => <MemberProfile {...props} isSingleColumn={isSingleColumn} />} />
            <Route path={`/:context(all)/:view(members)/:personId/${OPTIONAL_POST_MATCH}`} component={MemberProfile} />
            {/* All and Public Routes */}
            <Route path={`/:context(all|public)/:view(events|projects)/${OPTIONAL_POST_MATCH}`} component={Feed} />
            <Route path={`/:context(all|public)/:view(map)/${OPTIONAL_POST_MATCH}`} component={MapExplorer} />
            <Route path={`/:context(all|public)/:view(map)/${OPTIONAL_GROUP_MATCH}`} component={MapExplorer} />
            <Route path='/:context(all|public)/:view(topics)/:topicName' component={Feed} />
            <Route path='/:context(all)/:view(topics)' component={AllTopics} />
            <Route path={`/:context(all|public)/${OPTIONAL_POST_MATCH}`} component={Feed} />
            {/* Group Routes */}
            {group && !memberOfCurrentGroup &&
              <Route path={`/:context(groups)/:groupSlug`} render={props => <GroupDetail {...props} group={group} />} />}
            <Route path={`/:context(groups)/:groupSlug/:view(map)/${OPTIONAL_POST_MATCH}`} component={MapExplorer} />
            <Route path={`/:context(groups)/:groupSlug/:view(map)/${OPTIONAL_GROUP_MATCH}`} component={MapExplorer} />
            <Route path={`/:context(groups)/:groupSlug/:view(events|projects)/${OPTIONAL_POST_MATCH}`} component={Feed} />
            <Route path='/:context(groups)/:groupSlug/:view(groups)' component={Groups} />
            <Route path={`/:context(groups)/:groupSlug/:view(members)/:personId/${OPTIONAL_POST_MATCH}`} component={MemberProfile} />
            <Route path='/:context(groups)/:groupSlug/:view(members)' component={Members} />
            <Route path={`/:context(groups)/:groupSlug/:view(topics)/:topicName/${OPTIONAL_POST_MATCH}`} component={Feed} />
            <Route path='/:context(groups)/:groupSlug/:view(topics)' component={AllTopics} />
            <Route path='/:context(groups)/:groupSlug/:view(settings)' component={GroupSettings} />
            <Route path={`/:context(groups)/:groupSlug/${OPTIONAL_POST_MATCH}`} component={Feed} />
            {/* Other Routes */}
            <Route path='/settings' component={UserSettings} />
            <Route path='/search' component={Search} />
          </Switch>
        </Div100vh>
        {group && memberOfCurrentGroup &&
          <div styleName={cx('sidebar', { hidden: (hasDetail || isMapViewPath(location.pathname)) })}>
            <Switch>
              <Route path={`/:context(groups)/:groupSlug/:view(events|map|groups|projects)/${OPTIONAL_NEW_POST_MATCH}`} component={GroupSidebar} />
              <Route path={`/:context(groups)/:groupSlug/:view(topics)/:topicName/${OPTIONAL_NEW_POST_MATCH}`} component={GroupSidebar} />
              <Route path={`/:context(groups)/:groupSlug/${OPTIONAL_NEW_POST_MATCH}`} component={GroupSidebar} />
            </Switch>
          </div>
        }
        <div styleName={cx('detail', { hidden: !hasDetail })} id={DETAIL_COLUMN_ID}>
          <Switch>
            {detailRoutes.map(({ path, component }) =>
              <Route path={path} component={component} key={path} />)}
          </Switch>
        </div>
      </div>
      <Route path='/messages/:messageThreadId?' render={props => <Messages {...props} />} />
      <Switch>
        {createRoutes.map(({ path }) =>
          <Route path={path + '/create'} key={path + 'create'} children={({ match, location }) =>
            <CreateModal match={match} location={location} />} />)}
        {createRoutes.map(({ path }) =>
          <Route path={path + '/' + REQUIRED_EDIT_POST_MATCH} key={path + 'editpost'} children={({ match, location }) =>
            <PostEditorModal match={match} location={location} />} />)}
      </Switch>
      <SocketListener location={location} />
      <SocketSubscriber type='group' id={get('slug', group)} />
      <Intercom appID={isTest ? null : config.intercom.appId} hide_default_launcher />
      <Joyride
        run={this.state.run}
        continuous
        showProgress
        showClose
        tooltipComponent={TourTooltip}
        steps={this.state.steps}
      />
    </Div100vh>
  }
}

export function RedirectToSignupFlow ({ pathname }) {
  if (isSignupPath(pathname)) return null

  return <Redirect to='/signup/upload-photo' />
}

export function RedirectToGroup ({ path, currentUser }) {
  let redirectToPath = '/all'

  if (currentUser.memberships.count() > 0) {
    const mostRecentGroup = currentUser.memberships
      .orderBy(m => new Date(m.lastViewedAt), 'desc')
      .first()
      .group
    redirectToPath = `/groups/${mostRecentGroup.slug}`
  }

  return <Redirect exact from={path} to={redirectToPath} />
}

function TourTooltip ({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  tooltipProps
}) {
  return <div {...tooltipProps} styleName='tooltipWrapper'>
    <div styleName='tooltipContent'>
      <div styleName='tourGuide'><img src='/axolotl-tourguide.png' /></div>
      <div>
        {step.title && <div styleName='stepTitle'>{step.title}</div>}
        <div>{step.content}</div>
      </div>
    </div>
    <div styleName='tooltipControls'>
      {index > 0 && (
        <button styleName='backButton' {...backProps}>
          Back
        </button>
      )}
      {continuous && (
        <button styleName='nextButton' {...primaryProps}>
          Next
        </button>
      )}
      {!continuous && (
        <button {...closeProps}>
          Close
        </button>
      )}
    </div>
  </div>
}
