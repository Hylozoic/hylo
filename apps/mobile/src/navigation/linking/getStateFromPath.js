import { getStateFromPath as getStateFromPathDefault } from '@react-navigation/native'
import { isEmpty } from 'lodash/fp'
import { match } from 'path-to-regexp'
import { URL } from 'react-native-url-polyfill'
import queryString from 'query-string'
import store from 'store'
import setReturnToOnAuthPath from 'store/actions/setReturnToOnAuthPath'
import {
  routingConfig,
  initialRouteNamesConfig,
  AUTH_ROOT_SCREEN_NAME,
  DEFAULT_APP_HOST
} from '.'

// This is a very custom way of handling deep links in React Navigation
export default function getStateFromPath (providedPath) {
  // Not sure this trim is ever necessary, has been
  // historically been there so keeping it for now
  const groomedPath = providedPath.trim()
  const routeMatch = getRouteMatchForPath(groomedPath)

  // 404 handling
  if (!routeMatch) return null

  const { path, screenPath } = addParamsToScreenPath(routeMatch, routingConfig)

  const screenConfig = buildScreenConfigFromScreenPath(screenPath)

  // TODO: URQL! - either figure out how to get auth state here and restore this,
  // or implement another way to catch AUTH_ROOT route matches when non-authed and
  // set the returnToOnAuth path higher up the stack.
  // let { isAuthorized } = checkAuth()

  // // Set `returnToOnAuthPath` for routes requiring auth when not auth'd
  // if (!isAuthorized && screenPath.match(new RegExp(`^${AUTH_ROOT_SCREEN_NAME}`))) {
  //   store.dispatch(setReturnToOnAuthPath(providedPath))

  //   return null
  // }

  return getStateFromPathDefault(path, screenConfig)
}

export function getRouteMatchForPath (providedPath, routes = routingConfig) {
  const url = new URL(providedPath, DEFAULT_APP_HOST)
  const pathname = url.pathname.toLowerCase()

  for (const linkingPathMatcher in routes) {
    const pathMatch = match(linkingPathMatcher, { decode: decodeURIComponent, sensitive: false })(pathname)

    if (pathMatch) {
      const screenPath = routes[linkingPathMatcher]

      return {
        pathname,
        search: url.search,
        pathMatch,
        screenPath
      }
    }
  }
}

export function addParamsToScreenPath (routeMatch) {
  if (routeMatch) {
    const {
      pathname,
      search,
      pathMatch,
      screenPath
    } = routeMatch
    const routeParams = []

    if (!isEmpty(search)) routeParams.push(search.substring(1))
    if (!isEmpty(pathMatch.params)) routeParams.push(queryString.stringify(pathMatch.params))

    // Needed for JoinGroup
    routeParams.push(`originalLinkingPath=${encodeURIComponent(pathname + search)}`)

    const routeParamsQueryString = routeParams.join('&')
    const path = `${pathname}?${routeParamsQueryString}`

    return { screenPath, path }
  }
}

export function buildScreenConfigFromScreenPath (screenPath) {
  const screenPathSegments = screenPath.split('/')
  const makeScreenConfig = (screenNames, screenConfig = {}) => {
    const screenName = screenNames.pop()
    const initialRouteName = Object.keys(initialRouteNamesConfig).includes(screenName)

    if (initialRouteName) {
      screenConfig.initialRouteName = initialRouteNamesConfig[screenName]
    }

    if (Object.keys(screenConfig).length === 0) {
      screenConfig = {
        screens: {
          [screenName]: '*'
        }
      }
    } else {
      screenConfig = {
        screens: {
          [screenName]: screenConfig
        }
      }
    }

    return screenNames.length > 0
      ? makeScreenConfig(screenNames, screenConfig)
      : screenConfig
  }

  return makeScreenConfig(screenPathSegments)
}
