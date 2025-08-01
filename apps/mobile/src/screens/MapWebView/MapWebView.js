import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import { ALL_GROUPS_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG } from '@hylo/navigation'
import HyloWebView from 'components/HyloWebView'

// Matches actual group paths (e.g. not /all or /public)
export const MATCHER_GROUP_SLUG = '[a-zA-Z0-9-]+$'
export const MATCHER_GROUP_ROOT_PATH = `/groups/${MATCHER_GROUP_SLUG}$`

// Matches special group paths (e.g. /all and /public)
export const MATCHER_GROUP_ALL_AND_PUBLIC_ROOT_PATH = `/(${ALL_GROUPS_CONTEXT_SLUG}|${PUBLIC_CONTEXT_SLUG}|${MY_CONTEXT_SLUG})$`

export default function MapWebView ({ navigation }) {
  const { t } = useTranslation()
  const webViewRef = useRef(null)
  const [{ currentGroup: group }] = useCurrentGroup()
  const [path, setPath] = useState()
  const [canGoBack, setCanGoBack] = useState(false)

  const screenTitle = (group) => {
    if (group?.slug === PUBLIC_CONTEXT_SLUG) return t('Public Map')
    if (group?.slug === MY_CONTEXT_SLUG) return t('My Groups Map')
    return group?.name
  }

  useEffect(() => {
    navigation.setOptions({
      title: screenTitle(group),
      // Disables going back by pull right on this screen
      gestureEnabled: false,
      headerLeftOnPress: canGoBack ? webViewRef.current.goBack : undefined
    })

    // Disables swipeEnabled on DrawerNavigator
    navigation.getParent()?.getParent()?.setOptions({ swipeEnabled: false })
    if ([ALL_GROUPS_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG].includes(group?.slug)) {
      setPath(() => `/${group?.slug}/map`)
    } else if (group?.slug === MY_CONTEXT_SLUG) {
      setPath(() => `/${ALL_GROUPS_CONTEXT_SLUG}/map`)
    } else {
      setPath(() => `/groups/${group?.slug}/map`)
    }

    // Re-enables swipeEnabled on DrawerNavigator when screen blurs
    return () => navigation.getParent()?.getParent()?.setOptions({ swipeEnabled: true })
  }, [group?.slug, canGoBack])

  const handledWebRoutes = [
    '(.*)/map/create'
  ]

  return (
    <HyloWebView
      /*

        Required for emulator with the map but may be disadvantageous for actual
        devices as this has the effect of disabling hardware acceleration:

        ref. https://github.com/react-native-webview/react-native-webview/issues/575#issuecomment-800997520

        * Map still may not render on some older Android OS versions / devices
          adding a check for Android API version here and switching value
          to 'software' for API < 28'ish API may fix those cases.

      */
      androidLayerType='hardware'
      handledWebRoutes={handledWebRoutes}
      onNavigationStateChange={({ url, canGoBack: providedCanGoBack }) => {
        setCanGoBack(providedCanGoBack)
      }}
      path={path}
      ref={webViewRef}
    />
  )
}
