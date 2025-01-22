import { useCallback } from 'react'
import { Linking } from 'react-native'
import { getActionFromState, CommonActions, useNavigation } from '@react-navigation/native'
import { prefixes, DEFAULT_APP_HOST, staticPages } from 'navigation/linking'
import getStateFromPath, { getRouteMatchForPath } from 'navigation/linking/getStateFromPath'
import { URL } from 'react-native-url-polyfill'
import { navigationRef } from 'navigation/linking/helpers'

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

    const routeMatchForPath = getRouteMatchForPath(linkingPath)
    if (routeMatchForPath) {
      console.log(`!!! openURL debug -- ${linkingPath} route match:`, routeMatchForPath)
    } else {
      console.log(`!!! openURL debug -- ${linkingPath} NO ROUTE MATCHED`)
    }

    const stateForPath = getStateFromPath(linkingPath)

    if (stateForPath) {
      console.log(`!!! openURL debug -- ${linkingPath} nav state:`, stateForPath)
      const actionForPath = getActionFromState(stateForPath)
      console.log(`!!! openURL debug -- ${linkingPath} nav action:`, actionForPath)

      if (reset) {
        return navigationRef.dispatch(
          CommonActions.reset({
            routes: [actionForPath.payload]
          })
        )
      }

      return navigation.dispatch(actionForPath)
    } else {
      console.log(`!!! openURL debug -- ${linkingPath} NO NAV STATE`)
      return null
    }
  } else if (await Linking.canOpenURL(providedPathOrURL)) {
    return Linking.openURL(providedPathOrURL)
  }
}

// // For debugging:

// import getStateFromPath from 'navigation/linking/getStateFromPath'
// // getStateFromPath: 
// // Takes a single argument (e.g. '/groups/my-group/chat/my-chat' and
// // returns a React Navigation state composed from whatever linking matched in src/navigation/linking/index.js)
// // match:

// import { match } from 'path-to-regexp'
// // The first argument is a "path matcher" (see: https://github.com/pillarjs/path-to-regexp/tree/6.x), and returns
// // a function regex function which will return true/false depending on whatever string it is passed matching with that regex,
// // e.g. match('/:context(groups)/:groupSlug/chat/:topicName')('/groups/my-group/chat/my-chat')