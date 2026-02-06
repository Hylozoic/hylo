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
  // ========================================
  // NATIVE ROUTES (Login/Signup)
  // ========================================
  '/login':                                                               `${NON_AUTH_ROOT_SCREEN_NAME}/Login`,
  '/reset-password':                                                      `${NON_AUTH_ROOT_SCREEN_NAME}/ForgotPassword`,
  '/signup/:step?':                                                       `${NON_AUTH_ROOT_SCREEN_NAME}/Signup/Signup Intro`,
  '/noo/login/(jwt|token)':                                               'LoginByTokenHandler',
  // TODO:  Routing - oauth not currently handled, and I don't think we had planned to yet in Mobile.
  '/oauth/consent/:uid':                                                  `${NON_AUTH_ROOT_SCREEN_NAME}/Login`,
  '/oauth/login/:uid':                                                    `${NON_AUTH_ROOT_SCREEN_NAME}/Login`,

  // JoinGroup - Available in both Auth and Non-Auth state
  // Needs to check for valid invite and potentially auth the user
  '/:context(groups)/:groupSlug/join/:accessCode':                        'JoinGroup',
  '/h/use-invitation':                                                    'JoinGroup',

  
  // ========================================
  // WEBVIEW CATCH-ALL
  // All other authenticated routes go to PrimaryWebView
  // The web app handles routing internally
  // ========================================
  ':path(.*)':                                                            `${AUTH_ROOT_SCREEN_NAME}/Main`,

  /* 
    DEPRECATED ROUTES - Commented out but kept for reference
    All these routes now flow through PrimaryWebView (Main screen)
    The web app handles the actual routing and rendering
    
    Previously had 160+ routes mapping to specific native screens like:
    - `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Stream`
    - `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Post Details`
    - `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Chat Room`
    - `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Home Tab/Map`
    - `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Messages Tab/Thread`
    - `${AUTH_ROOT_SCREEN_NAME}/Drawer/Tabs/Search Tab`
    - etc...
    
    All those nested navigators (Drawer → Tabs → Home Tab → Screen) 
    are now replaced by a single PrimaryWebView that loads the web app.
    
    See git history for full list of deprecated routes.
    Last used: 2025-01-26
  */
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
