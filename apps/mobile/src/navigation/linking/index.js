import { modalScreenName } from 'hooks/useIsModalScreen'
import getStateFromPath from 'navigation/linking/getStateFromPath'
import getInitialURL from 'navigation/linking/getInitialURL'
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

/* eslint-disable key-spacing */
export const routingConfig = {
  // Auth & Signup Routes
  '/login':                                               `${NON_AUTH_ROOT_SCREEN_NAME}/Login`,
  // TODO: Routing - Handle this in Login by setting the returnToOnAuth path to direct to the auth'd Welcome page for the given groupSlug querystring param
  '/welcome':                                             `${NON_AUTH_ROOT_SCREEN_NAME}/Login`,
  '/:context(groups)/:groupSlug/join/:accessCode':        `${NON_AUTH_ROOT_SCREEN_NAME}/JoinGroup`,
  '/reset-password':                                      `${NON_AUTH_ROOT_SCREEN_NAME}/ForgotPassword`,
  '/signup/:step(verify-email)':                          `${NON_AUTH_ROOT_SCREEN_NAME}/Signup/SignupEmailValidation`,
  '/signup/:step?':                                       `${NON_AUTH_ROOT_SCREEN_NAME}/Signup/Signup Intro`,
  '/signup':                                              `${NON_AUTH_ROOT_SCREEN_NAME}/Signup/Signup Intro`,
  // TODO:  Routing - not currently handled correctly here, but there was at some point an implementation, I think. Search for jwt in project.
  '/oauth/consent/:uid':                                  `${NON_AUTH_ROOT_SCREEN_NAME}/Login`,
  '/oauth/login/:uid':                                    `${NON_AUTH_ROOT_SCREEN_NAME}/Login`,

  // Public Routes
  '/public':                                             `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/public/stream':                                      `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/public/discussions':                                 `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/public/events':                                      `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/public/groups':                                      `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Group Explorer`,
  '/public/map':                                         `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Map`,
  '/public/projects':                                    `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/public/proposals':                                   `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/public/requests-and-offers':                         `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/public/resources':                                   `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/public/topics/:topicName':                           `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,

  // Group-Based Routes
  '/groups/:groupSlug':                                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Group Detail`,
  '/groups/:groupSlug/about':                            `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Group Detail`,
  '/groups/:groupSlug/all-views':                        `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/All Views`,
  '/groups/:groupSlug/chat/:topicName':                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/ChatRoom`,
  '/groups/:groupSlug/chat/:topicName/post/:postId':     `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/ChatRoom`,
  '/groups/:groupSlug/custom/:customViewId':             `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/groups/:groupSlug/discussions':                      `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/groups/:groupSlug/events':                           `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/groups/:groupSlug/groups':                           `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Group Explorer`,
  '/groups/:groupSlug/join/:accessCode':                 `${AUTH_ROOT_SCREEN_NAME}/JoinGroup`,
  '/groups/:groupSlug/map':                              `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Map`,
  '/groups/:groupSlug/members/:personId':                `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Member Profile`,
  '/groups/:groupSlug/:streamType(moderation)':          `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/groups/:groupSlug/post/:postId':                     `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Post Detail`,
  '/groups/:groupSlug/projects':                         `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/groups/:groupSlug/proposals':                        `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/groups/:groupSlug/requests-and-offers':              `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/groups/:groupSlug/resources':                        `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,

  '/groups/:groupSlug/settings':                         `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Settings`,
  '/groups/:groupSlug/settings/agreements':              `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Agreements`,
  '/groups/:groupSlug/settings/delete':                  `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Delete`,

  // TODO:  Routing - not currently handled
  // '/groups/:groupSlug/settings/export':                  `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Export Data`,
  // '/groups/:groupSlug/settings/import':                  `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Import Export`,
  // TODO:  Routing - this was around before...
  // '/:context(groups)/:groupSlug/settings':               `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Settings`,
  '/groups/:groupSlug/settings/roles':                   `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Roles`,
  '/groups/:groupSlug/settings/invite':                  `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Invite`,
  '/groups/:groupSlug/settings/privacy':                 `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Privacy`,
  '/groups/:groupSlug/settings/relationships':           `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Related Groups`,
  '/groups/:groupSlug/settings/requests':                `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Join Requests`,
  '/groups/:groupSlug/settings/responsibilities':        `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Responsibilities`,
  '/groups/:groupSlug/stream':                           `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/groups/:groupSlug/topics/:topicName':                `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,

  // All Context Routes
  '/all/map':                                            `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Map`,
  '/all/members/:personId':                              `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Member Profile`,
  '/all/stream':                                         `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/all/topics/:topicName':                              `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  // TODO:  Routing - potentially group these
  '/all/discussions':                                    `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/all/events':                                         `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/all/projects':                                       `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/all/proposals':                                      `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/all/requests-and-offers':                            `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/all/resources':                                      `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,

  // User-Specific Routes
  '/my/account':                                        `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Settings Tab/Account`,
  '/my/announcements':                                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/my/edit-profile':                                   `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Settings Tab/Edit Profile`,
  '/my/groups':                                         `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/User Groups`,
  '/my/interactions':                                   `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/my/invitations':                                    `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Settings Tab/Manage Invites`,
  '/my/locale':                                         `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Settings Tab/Locale`,
  '/my/mentions':                                       `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/my/notifications':                                  `${AUTH_ROOT_SCREEN_NAME}/${modalScreenName('Notifications')}`,
  '/my/posts':                                          `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/my/saved-searches':                                 `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Settings Tab/Saved Searches`,
  // TODO:  Routing - potentially group these
  '/my/discussions':                                    `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/my/events':                                         `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/my/projects':                                       `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/my/proposals':                                      `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/my/requests-and-offers':                            `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
  '/my/resources':                                      `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,

  // /messages
  '/messages/new':                                      `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Messages Tab/New Message`,
  '/messages/:id':                                      `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Messages Tab/Thread`,
  '/messages':                                          `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Messages Tab/Messages`,

  // Miscellaneous Routes
  '/create-group':                                      `${AUTH_ROOT_SCREEN_NAME}/Create Group`,
  '/post/:postId':                                      `${AUTH_ROOT_SCREEN_NAME}/${modalScreenName('Post Details')}`,
  '/notifications':                                     `${AUTH_ROOT_SCREEN_NAME}/${modalScreenName('Notifications')}`,
  '/search':                                            `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Search Tab`
}

// export const routingConfig1 = {
//   '/login':                                                  `${NON_AUTH_ROOT_SCREEN_NAME}/Login`,
//   '/reset-password':                                         `${NON_AUTH_ROOT_SCREEN_NAME}/ForgotPassword`,
//   '/noo/login/(jwt|token)':                                  'LoginByTokenHandler',
//   '/h/use-invitation':                                       'JoinGroup',
//   '/:context(groups)/:groupSlug/join/:accessCode':           'JoinGroup',
//   '/signup/:step(verify-email)':                             `${NON_AUTH_ROOT_SCREEN_NAME}/Signup/SignupEmailValidation`,
//   '/signup/:step?':                                          `${NON_AUTH_ROOT_SCREEN_NAME}/Signup/Signup Intro`,
//   '/signup':                                                 `${NON_AUTH_ROOT_SCREEN_NAME}/Signup/Signup Intro`,

//   '/hylo-editor':                                            `${AUTH_ROOT_SCREEN_NAME}/HyloEditor`,

//   // context group routes (/all, /public, /my)
//   '/:groupSlug(all|public)':                                 `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
//   '/:groupSlug(all|public)/post/:id':                        `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Post Details`,
//   '/:groupSlug(all|public)/post/:id/comments/:commentId':    `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Post Details`,
//   '/:groupSlug(all)/members/:id':                            `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Member`,
//   '/:groupSlug(all)/topics/:topicName':                      `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
//   '/:groupSlug(my)/posts':                                   `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/My Posts`,
//   '/:groupSlug(my)/interactions':                            `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Interactions`,
//   '/:groupSlug(my)/mentions':                                `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Mentions`,
//   '/:groupSlug(my)/announcements':                           `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Announcements`,

//   // map routes
//   '/:groupSlug(all|public)/map':                             `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Map`,
//   '/:context(groups)/:groupSlug/map':                        `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Map`,
//   '/:context(groups)/:groupSlug/map/create':                 `${AUTH_ROOT_SCREEN_NAME}/Edit Post`,

//   // /groups
//   '/:context(groups)/:groupSlug/settings/invite':            `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Invite`,
//   '/:context(groups)/:groupSlug/settings/requests':          `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Join Requests`,
//   '/:context(groups)/:groupSlug/settings/relationships':     `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Related Groups`,
//   '/:context(groups)/:groupSlug/settings/export':            `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Export Data`,
//   '/:context(groups)/:groupSlug/settings/delete':            `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Delete`,
//   '/:context(groups)/:groupSlug/settings':                   `${AUTH_ROOT_SCREEN_NAME}/Group Settings/Settings`,
//   '/:context(groups)/:groupSlug/groups':                     `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Group Relationships`,
//   '/:context(groups)/:groupSlug/chats/:topicName':           `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Chat`,
//   '/:context(groups)/:groupSlug/members/:id':                `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Member`,
//   '/:context(groups)/:groupSlug/members':                    `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Members`,
//   '/:context(groups)/:groupSlug/stream':                     `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
//   '/:context(groups)/:groupSlug/all-views':                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/All Views`,
//   '/:context(groups)/:groupSlug':                            `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
//   '/:context(groups)/:groupSlug/custom/:customViewId':       `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
//   '/:context(groups)/:groupSlug/explore':                    `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Group Explore`,
//   '/:context(groups)/:groupSlug/proposals':                  `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`,
//   '/:context(groups)/:groupSlug/create':                     `${AUTH_ROOT_SCREEN_NAME}/Edit Post`,
//   '/:context(groups)/:groupSlug/post/:id':                   `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Post Details`,
//   '/:context(groups)/:groupSlug/post/:id/comments/:commentId':`${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Post Details`,
//   '/:context(groups)/:groupSlug/post/:id/edit':              `${AUTH_ROOT_SCREEN_NAME}/Edit Post`,

//   // /settings
//   '/settings':                                               `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Settings Tab/Edit Profile`,
//   '/settings/account':                                       `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Settings Tab/Account`,
//   '/settings/notifications':                                 `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Settings Tab/Notifications`,
//   '/settings/blocked-users':                                 `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Settings Tab/Blocked Users`,
//   '/settings/:section?':                                     `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Settings Tab/Edit Profile`,

//   // /messages
//   '/messages/new':                                           `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Messages Tab/New Message`,
//   '/messages/:id':                                           `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Messages Tab/Thread`,
//   '/messages':                                               `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Messages Tab/Messages`,

//   // catch-alls
//   ':unmatchedBasePath(.*)/group/:groupSlug':                  `${AUTH_ROOT_SCREEN_NAME}/${modalScreenName('Group Explore')}`,
//   ':unmatchedBasePath(.*)/group/:groupSlug/explore':          `${AUTH_ROOT_SCREEN_NAME}/${modalScreenName('Group Explore')}`,
//   ':unmatchedBasePath(.*)/members/:id':                       `${AUTH_ROOT_SCREEN_NAME}/${modalScreenName('Member')}`,
//   ':unmatchedBasePath(.*)/post/:id':                          `${AUTH_ROOT_SCREEN_NAME}/${modalScreenName('Post Details')}`,
//   ':unmatchedBasePath(.*)/post/:id/comments/:commentId':      `${AUTH_ROOT_SCREEN_NAME}/${modalScreenName('Post Details')}`,
//   ':unmatchedBasePath(.*)/create/group':                      `${AUTH_ROOT_SCREEN_NAME}/Create Group`,
//   ':unmatchedBasePath(.*)/create/post':                       `${AUTH_ROOT_SCREEN_NAME}/Edit Post`,
//   ':unmatchedBasePath(.*)/post/:id/edit':                     `${AUTH_ROOT_SCREEN_NAME}/Edit Post`,

//   '/':                                                       `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`
// }

// These screens will always be present and be first for the key'd navigator
export const initialRouteNamesConfig = {
  // [AUTH_ROOT_SCREEN_NAME]: 'Drawer',
  // 'Home Tab': 'Group Navigation',
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
  '/newapp'
]

// Used for the `linking` prop of `NavigationContainer`.
// As we have replaced and handled most everything we use, this is probably not necessary
export default {
  prefixes,
  getStateFromPath,
  getInitialURL
}
