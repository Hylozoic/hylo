import React from 'react'
import { createBrowserRouter, createRoutesFromElements, Navigate, Route } from 'react-router-dom'
import { useSelector } from 'react-redux'
import ErrorBoundary from 'components/ErrorBoundary'
import Loading from 'components/Loading'
import AllTopics from 'routes/AllTopics'
import AllView from 'routes/AllView'
import AuthLayout from 'routes/AuthLayout'
import DefaultRoute from 'routes/AuthLayout/DefaultRoute'
import GroupHomeRoute from 'routes/AuthLayout/GroupHomeRoute'
import ChatRoom from 'routes/ChatRoom'
import CreateGroup from 'routes/CreateGroup'
import FinishRegistration from 'routes/NonAuthLayout/Signup/FinishRegistration'
import GroupDetail from 'routes/GroupDetail'
import GroupExplorer from 'routes/GroupExplorer'
import GroupWelcomePage from 'routes/GroupWelcomePage'
import Groups from 'routes/Groups'
import GroupSettings from 'routes/GroupSettings'
import JoinGroup from 'routes/JoinGroup'
import Login from 'routes/NonAuthLayout/Login'
import ManageNotifications from 'routes/NonAuthLayout/ManageNotifications'
import MapExplorer from 'routes/MapExplorer'
import MemberProfile from 'routes/MemberProfile'
import Members from 'routes/Members'
import Messages from 'routes/Messages'
import Moderation from 'routes/Moderation'
import NonAuthLayout from 'routes/NonAuthLayout'
import OAuthConsent from 'routes/OAuth/Consent'
import OAuthLogin from 'routes/OAuth/Login'
import PasswordReset from 'routes/NonAuthLayout/PasswordReset'
import PostDetail from 'routes/PostDetail'
import PublicLayoutRouter from 'routes/PublicLayoutRouter'
import Search from 'routes/Search'
import Signup from 'routes/NonAuthLayout/Signup'
import SignupRouter from 'routes/NonAuthLayout/Signup/SignupRouter' // TODO: rename SIgnupLayout
import Stream from 'routes/Stream'
import UserSettings from 'routes/UserSettings'
import VerifyEmail from 'routes/NonAuthLayout/Signup/VerifyEmail'
import WelcomeWizardRouter from 'routes/WelcomeWizardRouter'
import getLastViewedGroup from 'store/selectors/getLastViewedGroup'
import {
  POST_DETAIL_MATCH, GROUP_DETAIL_MATCH, postUrl,
  groupHomeUrl
} from 'util/navigation'

import Root from './Root'

// const App = React.lazy(() => import('./App'))
const HyloEditorMobile = React.lazy(() => import('routes/HyloEditorMobile'))
const Feature = React.lazy(() => import('components/PostCard/Feature'))

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      path='/*'
      element={<Root />}
      errorElement={<ErrorBoundary />}
    >
      {/* **** Special routes for mobile app **** */}
      <Route path='hyloApp/editor' element={<HyloEditorMobile />} />
      <Route path='hyloApp/videoPlayer' element={<Feature />} />

      {/* **** Routes that work when auth or non-auth **** */}
      <Route path='notifications' element={<ManageNotifications />} />
      <Route path='groups/:groupSlug/join/:accessCode' element={<JoinGroup />} />
      <Route path='oauth/login/:uid' element={<OAuthLogin />} />
      <Route path='oauth/consent/:uid' element={<OAuthConsent />} />

      <Route element={<NonAuthLayout />}>
        <Route path='login' element={<Login />} />
        <Route path='signup' element={<SignupRouter />}>
          <Route path='verify-email' element={<VerifyEmail />} />
          <Route path='finish' element={<FinishRegistration />} />
          <Route path='*' element={<Signup />} />
        </Route>
        <Route path='reset-password' element={<PasswordReset />} />
        <Route path='h/use-invitation' element={<JoinGroup />} />
      </Route>

      <Route element={<AuthLayout />}>
        {/* **** Member Routes **** */}
        <Route path='members/:personId/*' element={<MemberProfile />} />

        {/* **** Public Routes **** */}
        <Route path='public/stream/*' element={<Stream context='public' />} />
        <Route path='public/projects/*' element={<Stream context='public' view='projects' />} />
        <Route path='public/proposals/*' element={<Stream context='public' view='proposals' />} />
        <Route path='public/events/*' element={<Stream context='public' />} />
        <Route path='public/map/*' element={<MapExplorer context='public' />} />
        <Route path='public/groups/*' element={<GroupExplorer />} />
        <Route path='public/topics/:topicName/*' element={<Stream context='public' />} />
        <Route path='public/*' element={<Stream context='public' />} />

        {/* **** Group Routes **** */}
        <Route path='create-group/*' element={<CreateGroup />} />
        <Route path='groups/:joinGroupSlug/join/:accessCode' element={<JoinGroup />} />
        <Route path='h/use-invitation' element={<JoinGroup />} />
        <Route path='groups/:groupSlug/about/*' element={<GroupDetail context='groups' />} />
        <Route path='groups/:groupSlug/welcome/*' element={<GroupWelcomePage />} />
        <Route path='groups/:groupSlug/map/*' element={<MapExplorer context='groups' view='map' />} />
        <Route path='groups/:groupSlug/stream/*' element={<Stream context='groups' view='stream' />} />
        <Route path='groups/:groupSlug/discussions/*' element={<Stream context='groups' view='discussions' />} />
        <Route path='groups/:groupSlug/events/*' element={<Stream context='groups' view='events' />} />
        <Route path='groups/:groupSlug/resources/*' element={<Stream context='groups' view='resources' />} />
        <Route path='groups/:groupSlug/projects/*' element={<Stream context='groups' view='projects' />} />
        <Route path='groups/:groupSlug/proposals/*' element={<Stream context='groups' view='proposals' />} />
        <Route path='groups/:groupSlug/requests-and-offers/*' element={<Stream context='groups' view='requests-and-offers' />} />
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
        <Route path={`groups/:groupSlug/${POST_DETAIL_MATCH}`} element={<PostDetail />} />
        <Route path='groups/:groupSlug/moderation/*' element={<Moderation context='groups' />} />
        <Route path='groups/:groupSlug/*' element={<GroupHomeRoute />} />
        <Route path={`${POST_DETAIL_MATCH}`} element={<PostDetail />} />

        {/* **** My Routes **** */}
        <Route path='all/events/*' element={<Stream context='all' />} />
        <Route path='all/map/*' element={<MapExplorer context='all' />} />
        <Route path='all/stream/*' element={<Stream context='all' />} />
        <Route path='all/projects/*' element={<Stream context='all' view='projects' />} />
        <Route path='all/proposals/*' element={<Stream context='all' view='proposals' />} />
        <Route path='all/topics/:topicName/*' element={<Stream context='all' />} />
        <Route path='all/topics/*' element={<AllTopics />} />
        <Route path='all/*' element={<Stream context='all' />} />
        <Route path='my/posts/*' element={<Stream context='my' view='posts' />} />
        <Route path='my/interactions/*' element={<Stream context='my' view='interactions' />} />
        <Route path='my/announcements/*' element={<Stream context='my' view='announcements' />} />
        <Route path='my/mentions/*' element={<Stream context='my' view='mentions' />} />
        <Route path='my/*' element={<UserSettings />} />
        <Route path='my' element={<Navigate to='/my/posts' replace />} />

        {/* **** Other Routes **** */}
        <Route path='welcome/*' element={<WelcomeWizardRouter />} />
        <Route path='messages/:messageThreadId' element={<Messages />} />
        <Route path='messages' element={<Messages />} /> {/* TODO: check if this is right */}

        {/* Keep old settings paths for mobile */}
        <Route path='settings/*' element={<UserSettings />} />

        <Route path='search' element={<Search />} />
      </Route>

      <Route path='public' element={<PublicLayoutRouter />}>
        <Route path='map/*' element={<MapExplorer />} />
        <Route path='groups/*' element={<GroupExplorer />} />
      </Route>

      {/* **** Default Route (404) **** */}
      <Route path='*' element={<DefaultRoute />} />
    </Route>
  )
)

export default router
