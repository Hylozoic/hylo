import { getStateFromPath as getStateFromPathDefault } from '@react-navigation/native'
import { isEmpty, isFunction } from 'lodash/fp'
import { match } from 'path-to-regexp'
import { URL } from 'react-native-url-polyfill'
import queryString from 'query-string'
import { ALL_GROUPS_CONTEXT_SLUG, MY_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG } from '@hylo/navigation'
import { useAuthStore } from '@hylo/contexts/AuthContext'
import useLinkingStore from './store'
import {
  routingConfig,
  initialRouteNamesConfig,
  AUTH_ROOT_SCREEN_NAME,
  DEFAULT_APP_HOST
} from './config'

export default function getStateFromPath (providedPath: string) {
  const groomedPath = providedPath.trim()
  const routeMatch = getRouteMatchForPath(groomedPath)
  const authState = useAuthStore.getState()
  const linkingState = useLinkingStore.getState()

  if (!routeMatch) return null

  if (isFunction(routeMatch.screenPath)) {
    routeMatch.screenPath(routeMatch.search)
    return null
  }

  const { path, screenPath } = addParamsToScreenPath(routeMatch)
  const screenConfig = buildScreenConfigFromScreenPath(screenPath)

  if (!authState.isAuthorized && screenPath.match(new RegExp(`^${AUTH_ROOT_SCREEN_NAME}`))) {
    linkingState.setReturnToOnAuthPath(providedPath)
    return null
  }

  return getStateFromPathDefault(path, screenConfig)
}

export function getRouteMatchForPath (providedPath: string, routes = routingConfig) {
  const url = new URL(providedPath, DEFAULT_APP_HOST)
  const pathname = url.pathname.toLowerCase()

  for (const pathMatcher in routes) {
    const pathMatch = match(pathMatcher, { decode: decodeURIComponent, sensitive: false })(pathname)

    if (pathMatch) {
      const screenPath = routes[pathMatcher as keyof typeof routes]
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

export function addParamsToScreenPath (routeMatch: NonNullable<ReturnType<typeof getRouteMatchForPath>>) {
  const {
    pathname,
    pathMatcher,
    pathMatch,
    search,
    screenPath
  } = routeMatch
  const routeParams: string[] = []

  if (pathMatch?.params?.context === ALL_GROUPS_CONTEXT_SLUG || pathMatch?.params?.context === MY_CONTEXT_SLUG) {
    pathMatch.params.context = MY_CONTEXT_SLUG
  }

  if (pathMatch?.params?.context === PUBLIC_CONTEXT_SLUG || pathMatch?.params?.context === MY_CONTEXT_SLUG) {
    pathMatch.params.groupSlug = pathMatch?.params?.context
  }

  if (!isEmpty(search)) routeParams.push(search.substring(1))
  if (!isEmpty(pathMatch.params)) routeParams.push(queryString.stringify(pathMatch.params))
  if (!isEmpty(pathMatcher)) routeParams.push(queryString.stringify({ pathMatcher }))

  if (pathMatcher !== '/noo/login/(jwt|token)') {
    routeParams.push(`originalLinkingPath=${encodeURIComponent(pathname + search)}`)
  }

  const routeParamsQueryString = routeParams.join('&')
  const path = `${pathname}?${routeParamsQueryString}`

  return { screenPath, path }
}

export function buildScreenConfigFromScreenPath (screenPath: string) {
  const screenPathSegments = screenPath.split('/')

  const makeScreenConfig = (screenNames: string[], screenConfig: Record<string, unknown> = {}): Record<string, unknown> => {
    const screenName = screenNames.pop() as string
    const initialRouteName = Object.keys(initialRouteNamesConfig).includes(screenName)

    if (initialRouteName) {
      screenConfig.initialRouteName = initialRouteNamesConfig[screenName as keyof typeof initialRouteNamesConfig]
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
