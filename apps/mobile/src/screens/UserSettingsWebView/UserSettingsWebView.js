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
