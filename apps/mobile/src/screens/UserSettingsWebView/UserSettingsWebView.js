// DEPRECATED: This screen is no longer used in the app.
// All content (including user settings) is now handled by PrimaryWebView.
// The web app provides the settings interface and handles logout.
// Kept for reference - may revisit native implementation in the future.
// Last used: 2025-01-26

import React, { useCallback, useRef } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import useRouteParams from 'hooks/useRouteParams'
import HyloWebView from 'components/HyloWebView'
import useLogout from 'hooks/useLogout'
import useCurrentUser from '@hylo/hooks/useCurrentUser'

export const TERMS_URL = 'https://hylo-landing.surge.sh/terms'

export default function UserSettingsWebView ({ path: pathProp, route }) {
  const webViewRef = useRef(null)
  const [, queryCurrentUser] = useCurrentUser({ requestPolicy: 'network-only', pause: true })
  const { originalLinkingPath, settingsArea } = useRouteParams()
  const logout = useLogout()

  const sourceOrPath = settingsArea === 'terms'
    ? { uri: TERMS_URL }
    : { path: originalLinkingPath }

  // Always re-queries CurrentUser onBlur
  useFocusEffect(
    useCallback(() => {
      return () => {
        queryCurrentUser()
      }
    }, [])
  )

  const nativeRouteHandler = () => ({
    '/login': () => logout()
  })

  return (
    <HyloWebView
      ref={webViewRef}
      {...sourceOrPath}
      nativeRouteHandler={nativeRouteHandler}
    />
  )
}
