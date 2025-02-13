import { useCallback } from 'react'
import { Linking } from 'react-native'
import { getActionFromState, CommonActions, useNavigation } from '@react-navigation/native'
import { prefixes, DEFAULT_APP_HOST, staticPages } from 'navigation/linking'
import getStateFromPath, { getRouteMatchForPath } from 'navigation/linking/getStateFromPath'
import { URL } from 'react-native-url-polyfill'
import { navigationRef } from 'navigation/linking/helpers'
import { isDev } from 'config'
// DEBUG is always false in production
const DEBUG = isDev && true

export default function useOpenURL () {
  const navigation = useNavigation()
  const boundOpenUrl = useCallback(async (pathOrURL, reset) => openURL(pathOrURL, reset, navigation), [navigation])

  return boundOpenUrl
}

export async function openURL (providedPathOrURL, reset, navigation = navigationRef) {
  const linkingURL = new URL(providedPathOrURL, DEFAULT_APP_HOST)

  if (
    prefixes.includes(linkingURL.origin) &&
    !staticPages.includes(linkingURL.pathname)
  ) {
    const linkingPath = linkingURL.pathname + linkingURL.search

    if (DEBUG) {
      // This happens in getStateFromPath, here only for debugging convenience
      const routeMatchForPath = getRouteMatchForPath(linkingPath)

      if (routeMatchForPath) {
        console.log(`!!! openURL: ${linkingPath} routeMatchForPath:`)
        console.dir(routeMatchForPath)
      } else {
        console.log(`!!! openURL: ${linkingPath} NO ROUTE MATCHED`)
      }
    }

    const stateForPath = getStateFromPath(linkingPath)

    if (stateForPath) {
      DEBUG && console.log(`!!! openURL: ${linkingPath} stateForPath:`)
      DEBUG && console.dir(stateForPath)

      const actionForPath = getActionFromState(stateForPath)

      DEBUG && console.log(`!!! openURL: ${linkingPath} actionForPath:`, { reset })
      DEBUG && console.dir(actionForPath)

      if (reset) {
        return navigationRef.dispatch(
          CommonActions.reset({
            routes: [actionForPath.payload]
          })
        )
      }

      return navigation.dispatch(actionForPath)
    } else {
      DEBUG && console.log(`!!! openURL: ${linkingPath} stateForPath: NOT FOUND`)
      return null
    }
  } else if (await Linking.canOpenURL(providedPathOrURL)) {
    DEBUG && console.log(`!!! openURL: ${providedPathOrUrl} passing to Linking.OpenURL as origin is not for this app, or path is to a known static page.`)

    return Linking.openURL(providedPathOrURL)
  }
}
