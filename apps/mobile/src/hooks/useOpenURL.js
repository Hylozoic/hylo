import { useCallback } from 'react'
import { Linking } from 'react-native'
import { getActionFromState, CommonActions, useNavigation } from '@react-navigation/native'
import { prefixes, DEFAULT_APP_HOST, staticPages } from 'navigation/linking'
import getStateFromPath from 'navigation/linking/getStateFromPath'
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
    const stateForPath = getStateFromPath(linkingPath)

    if (stateForPath) {
      const actionForPath = getActionFromState(stateForPath)

      if (reset) {
        return navigationRef.dispatch(
          CommonActions.reset({
            routes: [actionForPath.payload]
          })
        )
      }

      return navigation.dispatch(actionForPath)
    } else {
      return null
    }
  } else if (await Linking.canOpenURL(providedPathOrURL)) {
    return Linking.openURL(providedPathOrURL)
  }
}
