import { useCallback } from 'react'
import { Linking } from 'react-native'
import { CommonActions, getActionFromState, StackActions, useNavigation } from '@react-navigation/native'
import { prefixes, DEFAULT_APP_HOST, staticPages } from '../navigation/linking'
import { hyloUrlForExternalBrowser, shouldOpenHyloOidcInExternalBrowser } from '../navigation/linking/oidcExternalBrowserGate'
import getStateFromPath from '../navigation/linking/getStateFromPath'
import { URL } from 'react-native-url-polyfill'
import { navigationRef } from '../navigation/linking/helpers'

type NavigationLike = typeof navigationRef | ReturnType<typeof useNavigation>

export default function useOpenURL () {
  const navigation = useNavigation()
  return useCallback(
    (pathOrURL: string, options = {}) => openURL(pathOrURL, options, navigation),
    [navigation]
  )
}

export async function openURL (
  providedPathOrURL: string,
  options: { openExternal?: boolean, reset?: boolean, replace?: boolean } = {},
  navigation: NavigationLike = navigationRef
) {
  // Hylo-as-OIDC-provider and third-party OIDC flows must stay in the system browser
  if (shouldOpenHyloOidcInExternalBrowser(providedPathOrURL)) {
    const href = hyloUrlForExternalBrowser(providedPathOrURL)
    if (await Linking.canOpenURL(href)) {
      return Linking.openURL(href)
    }
    return null
  }

  const linkingURL = new URL(providedPathOrURL, DEFAULT_APP_HOST)
  const knownHyloappHosts = ['www.hylo.com', 'hylo.com', 'staging.hylo.com']
  const isHyloappURL = linkingURL.protocol === 'hyloapp:' && knownHyloappHosts.includes(linkingURL.host)

  if (
    (prefixes.includes(linkingURL.origin) || isHyloappURL) &&
    !staticPages.includes(linkingURL.pathname)
  ) {
    const linkingPath = linkingURL.pathname + linkingURL.search
    const stateForPath = getStateFromPath(linkingPath)

    if (stateForPath) {
      let actionForPath = getActionFromState(stateForPath)
      if (actionForPath) {
        if (options.reset) {
          actionForPath = CommonActions.reset({ routes: [actionForPath.payload] })
        } else if (options.replace) {
          actionForPath = StackActions.replace(actionForPath.payload.name, actionForPath.payload.params)
        }

        if ('dispatch' in navigation && navigation.dispatch) {
          navigation.dispatch(actionForPath)
        } else if ('current' in navigation && navigation.current) {
          navigation.current.dispatch(actionForPath)
        }
        return
      }
    }
  }

  if (options.openExternal !== false) {
    const href = linkingURL.href
    if (
      href.startsWith('exp+') ||
      href.startsWith('expo://') ||
      href.includes('expo-development-client')
    ) {
      return null
    }
    if (await Linking.canOpenURL(href)) {
      return Linking.openURL(href)
    }
  }

  return null
}

export function resetToPath (path: string, navigation: NavigationLike = navigationRef) {
  const stateForPath = getStateFromPath(path)
  if (!stateForPath) return
  const action = getActionFromState(stateForPath)
  if (!action) return
  if ('dispatch' in navigation && navigation.dispatch) {
    navigation.dispatch(action)
  }
}
