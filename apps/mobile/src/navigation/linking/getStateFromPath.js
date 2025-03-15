import { getStateFromPath as getStateFromPathDefault } from '@react-navigation/native'
import { isEmpty, isFunction } from 'lodash/fp'
import { match } from 'path-to-regexp'
import { URL } from 'react-native-url-polyfill'
import queryString from 'query-string'
import { ALL_GROUPS_CONTEXT_SLUG, MY_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG } from '@hylo/shared'
import { useAuthStore } from '@hylo/contexts/AuthContext'
import useLinkingStore from 'navigation/linking/store'
import {
  routingConfig,
  initialRouteNamesConfig,
  AUTH_ROOT_SCREEN_NAME,
  DEFAULT_APP_HOST
} from '.'

// This is a very custom way of handling deep links in React Navigation
export default function getStateFromPath (providedPath) {
  // This trim may be unnecessary, keeping it for now
  const groomedPath = providedPath.trim()
  const routeMatch = getRouteMatchForPath(groomedPath)
  const authState = useAuthStore.getState()
  const linkingState = useLinkingStore.getState()

  // 404 handling
  if (!routeMatch) return null

  // Currently only for redirectTo (defined and applied in linking/index)
  if (isFunction(routeMatch.screenPath)) {
    routeMatch.screenPath(routeMatch.search)
    return null
  }

  const { path, screenPath } = addParamsToScreenPath(routeMatch, routingConfig)

  const screenConfig = buildScreenConfigFromScreenPath(screenPath)

  // Set `returnToOnAuthPath` for routes requiring auth when not auth'd
  if (!authState.isAuthorized && screenPath.match(new RegExp(`^${AUTH_ROOT_SCREEN_NAME}`))) {
    linkingState.setReturnToOnAuthPath(providedPath)
    return null
  }

  return getStateFromPathDefault(path, screenConfig)
}

export function getRouteMatchForPath (providedPath, routes = routingConfig) {
  const url = new URL(providedPath, DEFAULT_APP_HOST)
  const pathname = url.pathname.toLowerCase()

  for (const pathMatcher in routes) {
    const pathMatch = match(pathMatcher, { decode: decodeURIComponent, sensitive: false })(pathname)

    if (pathMatch) {
      const screenPath = routes[pathMatcher]

      return {
        pathname,
        pathMatcher,
        pathMatch,
        search: url.search,
        screenPath
      }
    }
  }
}

export function addParamsToScreenPath (routeMatch) {
  if (routeMatch) {
    const {
      pathname,
      pathMatcher,
      pathMatch,
      search,
      screenPath
    } = routeMatch
    const routeParams = []

    // Overrides "all" context routes to be "my" context, remove when/if routing changes to align
    if (pathMatch?.params?.context === ALL_GROUPS_CONTEXT_SLUG || pathMatch?.params?.context === MY_CONTEXT_SLUG) {
      pathMatch.params.context = MY_CONTEXT_SLUG
    }

    // My and Public contexts are treated as groups so their identifying slug gets assigned to groupSlug
    if (pathMatch?.params?.context === PUBLIC_CONTEXT_SLUG || pathMatch?.params?.context === MY_CONTEXT_SLUG) {
      pathMatch.params.groupSlug = pathMatch?.params?.context
    }

    if (!isEmpty(search)) routeParams.push(search.substring(1))
    if (!isEmpty(pathMatch.params)) routeParams.push(queryString.stringify(pathMatch.params))
    if (!isEmpty(pathMatcher)) routeParams.push(queryString.stringify({ pathMatcher }))

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
