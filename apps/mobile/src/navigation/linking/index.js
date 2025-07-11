import { modalScreenName } from 'hooks/useIsModalScreen'
import getStateFromPath from 'navigation/linking/getStateFromPath'
import getInitialURL from 'navigation/linking/getInitialURL'
import { isDev, isTest } from 'config'
import { openURL } from 'hooks/useOpenURL'

/*

Hylo Custom link routing config and related utilities:

The current version of `react-navigation` doesn't have a way to map multiple paths
to the same screen. The below way of mapping screens to paths is being used to
construct and, otherwise in alternate to, `linking.config.screens`.

See: `navigation/linking/getStateFromPath.js` here, and https://reactnavigation.org/docs/configuring-links

All routes are always available, but routes that begin with `AUTH_ROOT_SCREEN_NAME`
will be set as the `returnToPath` and not navigated to until after
the user is authorized (see `AuthProvider`).

NOTE: The linking route paths below are equivalent to `exact` route paths in
React Router (web)

*/

export const AUTH_ROOT_SCREEN_NAME = 'AuthRoot'
export const NON_AUTH_ROOT_SCREEN_NAME = 'NonAuthRoot'

export const redirectTo = redirectPath => search => openURL(redirectPath)

// Handling of unknown routes, when in dev directs to "Unknown" screen/component for inspection
// but in Production and in Tests simply does the default of nothing when a route isn't matched.
export const unknownRouteMatch = isDev && !isTest ? { ':unmatchedBasePath(.*)': 'Unknown' } : {}

// TODO: Routing - /:groupSlug(all|public)/post/:id/comments/:commentId is still being used, so we need to add route/s for that
// TODO: Routing - "many of these routes can have /create/* added to the end to bring up the create post modal"

/* eslint-disable key-spacing */
export const routingConfig = {
  // Auth & Signup Routes
  '/login':                                                               `${NON_AUTH_ROOT_SCREEN_NAME}/Login`,
  '/reset-password':                                                      `${NON_AUTH_ROOT_SCREEN_NAME}/ForgotPassword`,
  // '/signup/:step(verify-email)':                                          `${NON_AUTH_ROOT_SCREEN_NAME}/Signup/SignupEmailValidation`,
  '/signup/:step?':                                                       `${NON_AUTH_ROOT_SCREEN_NAME}/Signup/Signup Intro`,
  '/noo/login/(jwt|token)':                                               'LoginByTokenHandler',
  // TODO:  Routing - oauth not currently handled, and I don't think we had planned to yet in Mobile.
  '/oauth/consent/:uid':                                                  `${NON_AUTH_ROOT_SCREEN_NAME}/Login`,
  '/oauth/login/:uid':                                                    `${NON_AUTH_ROOT_SCREEN_NAME}/Login`,

  // Available in both Auth and Non-Auth state as JoinGroup needs to check for a valid invite and initiate JTW auth
  // but this unlike all other cases, makes JoinGroup responsible for setting returnToOnAuth path when accessed in non-auth context
  '/:context(groups)/:groupSlug/join/:accessCode':                        'JoinGroup',
  '/h/use-invitation':                                                    'JoinGroup',

  // Used only for testing HyloEditor loading and config
  '/hylo-editor':                                                          `${AUTH_ROOT_SCREEN_NAME}/HyloEditor`,

  // TODO: Routing - Add /post/:postId optional to (probably all) routes going to Stream

  // /public context routes
  // TODO:  Routing - some of these need to be available when not auth'd
  '/:context(public)/groups':                                             `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Web View`,
  '/:context(public)/map':                                                `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Map`,
  '/:context(public)/topics/:topicName':                                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(public)/stream':                                             `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(public)/:streamType(discussions)':                           `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(public)/:streamType(events)':                                `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(public)/:streamType(projects)':                              `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(public)/:streamType(proposals)':                             `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(public)/:streamType(requests-and-offers)':                   `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(public)/:streamType(resources)':                             `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(public)':                                                    `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,

  // /my context routes
  '/:context(my)/:view(announcements)':                                   `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(my)/:view(interactions)':                                    `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(my)/:view(mentions)':                                        `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(my)/:view(posts)':                                           `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(my)/:settingsArea(account)':                                 `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/User Settings`,
  '/:context(my)/:settingsArea(blocked-users)':                           `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/User Settings`,
  '/:context(my)/:settingsArea(edit-profile)':                            `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/User Settings`,
  '/:context(my)/:settingsArea(invitations)':                             `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/User Settings`,
  '/:context(my)/:settingsArea(groups)':                                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/User Settings`,
  '/:context(my)/:settingsArea(locale)':                                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/User Settings`,
  '/:context(my)/:settingsArea(saved-searches)':                          `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/User Settings`,
  '/:context(my)/:settingsArea(notifications)':                           `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/User Settings`,
  '/:context(my)/:settingsArea(terms)':                                   `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/User Settings`,
  // TODO:  Routing - potentially group these
  '/:context(my)/:streamType(discussions)':                               `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(my)/:streamType(events)':                                    `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(my)/:streamType(projects)':                                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(my)/:streamType(proposals)':                                 `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(my)/:streamType(requests-and-offers)':                       `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(my)/:streamType(resources)':                                 `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  // TODO routing: As of 21 Feb 2025, these two routes only exists on mobile but it is an example of how we could shift the web routes.
  '/:context(my)/stream':                                                 `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(my)/tracks':                                                 `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/My Tracks`,
  '/:context(my)/tracks/:trackId':                                        `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Track Detail`,
  '/:context(my)/map':                                                    `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Map`,
  '/:context(my)':                                                         redirectTo('/my/posts'),

  // /all  routes -- NOTE: the "all" context is re-mapped to "my" by addParamsToScreenPath in getStateFromPath)
  '/:context(all)/map':                                                   `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Map`,
  '/all/members/:id':                                                     `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Member`,
  '/:context(all)/:groupSlug/map/create':                                 `${AUTH_ROOT_SCREEN_NAME}/Edit Post`,
  '/:context(all)/topics/:topicName':                                     `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  // TODO:  Routing - potentially group these
  '/:context(all)/stream':                                                `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(all)/:streamType(discussions)':                              `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(all)/:streamType(events)':                                   `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(all)/:streamType(projects)':                                 `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(all)/:streamType(proposals)':                                `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(all)/:streamType(requests-and-offers)':                      `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(all)/:streamType(resources)':                                `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,

  // /groups Routes
  '/:context(groups)/:groupSlug/about':                                   `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Web View`,
  '/:context(groups)/:groupSlug/all-views':                               `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/All Views`,
  '/:context(groups)/:groupSlug/post/:id':                                `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Post Details`,
  '/:context(groups)/:groupSlug/post/:id/edit':                           `${AUTH_ROOT_SCREEN_NAME}/Edit Post`,
  '/:context(groups)/:groupSlug/chat/:topicName':                         `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Chat Room`,
  // TODO: Routing - should probably go to Post Modal for now, or let it through and it will go to PostDetail in Webview, same for topics variant below
  '/:context(groups)/:groupSlug/chat/:topicName/post/:id':                `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Chat Room`,
  '/:context(groups)/:groupSlug/create':                                  `${AUTH_ROOT_SCREEN_NAME}/Edit Post`,
  '/:context(groups)/:groupSlug/explore':                                 `${AUTH_ROOT_SCREEN_NAME}/${modalScreenName('Group Explore')}`,
  '/:context(groups)/:groupSlug/groups':                                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Group Relationships`,
  '/:context(groups)/:groupSlug/map':                                     `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Map`,
  '/:context(groups)/:groupSlug/map/create':                              `${AUTH_ROOT_SCREEN_NAME}/Edit Post`,
  '/:context(groups)/:groupSlug/members':                                 `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Members`,
  '/:context(groups)/:groupSlug/members/:id':                             `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Member`,
  '/:context(groups)/:groupSlug/topics/:topicName':                       `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(groups)/:groupSlug/topics/:topicName/post/:id':              `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Chat Room`,
  '/:context(groups)/:groupSlug/topics':                                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Web View`,
  '/:context(groups)/:groupSlug/tracks/:trackId':                         `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Track Detail`,
  '/:context(groups)/:groupSlug/tracks':                                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Tracks`,
  '/:context(groups)/:groupSlug/custom/:customViewId':                    `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(groups)/:groupSlug/settings/:settingsArea?':                 `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Group Settings`,
  // TODO:  Routing - potentially group these
  '/:context(groups)/:groupSlug/stream':                                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(groups)/:groupSlug/:streamType(moderation)':                 `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Moderation`,
  '/:context(groups)/:groupSlug/:streamType(discussions)':                `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(groups)/:groupSlug/:streamType(events)':                     `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(groups)/:groupSlug/:streamType(projects)':                   `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(groups)/:groupSlug/:streamType(proposals)':                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(groups)/:groupSlug/:streamType(requests-and-offers)':        `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(groups)/:groupSlug/:streamType(resources)':                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/:context(groups)/:groupSlug/stream/post/:id':                         `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Post Details`,
  '/:context(groups)/:groupSlug/welcome':                                 `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Group Welcome Page`,
  '/:context(groups)/:groupSlug':                                         `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab`,

  // /messages
  '/messages/new':                                                        `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Messages Tab/New Message`,
  '/messages/:id':                                                        `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Messages Tab/Thread`,
  '/messages':                                                            `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Messages Tab/Messages`,

  // Miscellaneous Routes
  '/notifications':                                                       `${AUTH_ROOT_SCREEN_NAME}/Notifications`,
  '/search':                                                              `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Search Tab`,

  // Catch-Alls and Safeties
  // TODO: Routing -- We may want some or all of these to go away
  ':unmatchedBasePath(.*)/group/:groupSlug':                              `${AUTH_ROOT_SCREEN_NAME}/${modalScreenName('Group Explore')}`,
  ':unmatchedBasePath(.*)/group/:groupSlug/explore':                      `${AUTH_ROOT_SCREEN_NAME}/${modalScreenName('Group Explore')}`,
  ':unmatchedBasePath(.*)/members/:id':                                   `${AUTH_ROOT_SCREEN_NAME}/${modalScreenName('Member')}`,
  ':unmatchedBasePath(.*)/upload-action/:id':                             `${AUTH_ROOT_SCREEN_NAME}/Upload Action`,
  ':unmatchedBasePath(.*)/post/:id':                                      `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Post Details`,
  ':unmatchedBasePath(.*)/post/:id/comments/:commentId':                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Post Details`,
  ':unmatchedBasePath(.*)/create/group':                                  `${AUTH_ROOT_SCREEN_NAME}/Create Group`,
  ':unmatchedBasePath(.*)/create/post':                                   `${AUTH_ROOT_SCREEN_NAME}/Edit Post`,
  ':unmatchedBasePath(.*)/create':                                        `${AUTH_ROOT_SCREEN_NAME}/Creation`,
  ':unmatchedBasePath(.*)/post/:id/edit':                                 `${AUTH_ROOT_SCREEN_NAME}/Edit Post`,
  ...unknownRouteMatch
}

// NOTE: Any screens set here will be inserted before any other screens at this root
// If we want I think we can turn this back on for AUTH_ROOT_SCREEN_NAME and take
// "Drawer" out of the screen path of all of the above routes. Same for Messages.
export const initialRouteNamesConfig = {
  // [AUTH_ROOT_SCREEN_NAME]: 'Drawer',
  // 'Messages Tab': 'Messages'
}

export const DEFAULT_APP_HOST = 'https://www.hylo.com'

export const prefixes = [
  DEFAULT_APP_HOST,
  'https://staging.hylo.com',
  'hyloapp://'
]

// flag-shared
export const staticPages = [
  '',
  '/help',
  '/help/markdown',
  '/about',
  '/about/careers',
  '/about/contact',
  '/about/team',
  '/evolve',
  '/invite-expired',
  '/subscribe',
  '/styleguide',
  '/team',
  '/terms',
  '/terms/privacy',
  '/privacy',
  '/newapp'
]

// NOTE: This default export is here for optional/experimental use to apply our custom configuration to
// the `linking` prop of `NavigationContainer`. As we have replaced and handled most everything
// we use, this is probably not that appealing. See React Navigation docs on Linking for more details.
export default {
  prefixes,
  getStateFromPath,
  getInitialURL
}
