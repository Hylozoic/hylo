import { useCallback } from 'react'
import { Linking } from 'react-native'
import { getActionFromState, CommonActions, useNavigation, StackActions } from '@react-navigation/native'
import { prefixes, DEFAULT_APP_HOST, staticPages } from 'navigation/linking'
import getStateFromPath from 'navigation/linking/getStateFromPath'
import { URL } from 'react-native-url-polyfill'
import { navigationRef } from 'navigation/linking/helpers'
import { isDev } from 'config'

// DEBUG is always false in production
const DEBUG = isDev && false

export default function useOpenURL () {
  const navigation = useNavigation()
  const boundOpenUrl = useCallback(async (pathOrURL, options = {}) => openURL(pathOrURL, options, navigation), [navigation])

  return boundOpenUrl
}

export async function openURL (
  providedPathOrURL,
  options = {},
  navigation = navigationRef
) {
  // Debug logging for notification navigation
  if (__DEV__ && providedPathOrURL.includes('/settings/')) {
    console.log('🔍 openURL Notification Debug:', {
      providedPathOrURL,
      options,
      DEFAULT_APP_HOST
    })
  }

  const linkingURL = new URL(providedPathOrURL, DEFAULT_APP_HOST)

  if (
    prefixes.includes(linkingURL.origin) &&
    !staticPages.includes(linkingURL.pathname)
  ) {
    const linkingPath = linkingURL.pathname + linkingURL.search
    const stateForPath = getStateFromPath(linkingPath)

    // Debug logging for settings navigation
    if (__DEV__ && linkingPath.includes('/settings/')) {
      console.log('🔍 openURL Settings Navigation Debug:', {
        linkingPath,
        stateForPath,
        linkingURL: {
          origin: linkingURL.origin,
          pathname: linkingURL.pathname,
          search: linkingURL.search
        }
      })
    }

    if (stateForPath) {
      DEBUG && console.log(`!!! openURL: ${linkingPath} stateForPath:`)
      DEBUG && console.dir(stateForPath)

      let actionForPath = getActionFromState(stateForPath)

      if (options?.reset) {
        actionForPath = CommonActions.reset({ routes: [actionForPath.payload] })
      } else if (options?.replace) {
        actionForPath = StackActions.replace(actionForPath.payload.name, actionForPath.payload.params)
      }

      DEBUG && console.log(`!!! openURL: ${linkingPath} actionForPath (with options ${options}):`)
      DEBUG && console.dir(actionForPath)

      return navigation.dispatch(actionForPath)
    } else {
      DEBUG && console.log(`!!! openURL: ${linkingPath} stateForPath: NOT FOUND`)
      return null
    }
  } else if (await Linking.canOpenURL(providedPathOrURL)) {
    DEBUG && console.log(`!!! openURL: ${providedPathOrURL} passing to Linking.OpenURL as origin is not for this app, or path is to a known static page.`)

    return Linking.openURL(providedPathOrURL)
  }
}
