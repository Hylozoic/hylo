import React, { useCallback, useRef } from 'react'
import { WebViewMessageTypes } from '@hylo/shared'
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

  // NOTE The cases below and likely most similar cases going forward are mitigated
  // by the above useFocusEffect / onBlur handler which re-queries currentUser
  // const messageHandler = ({ type, data }) => {
  //   switch (type) {
  //     case WebViewMessageTypes.LEFT_GROUP: {
  //       if (data.groupId) {
  //         queryCurrentUser()
  //       }
  //     }

  //     // TODO: See https://github.com/Hylozoic/hylo-evo/tree/user-settings-webview-improvements
  //     // case 'USER_SETTINGS.SET_EDIT_PROFILE_UNSAVED': {
  //     //   console.log('!!! setting unsaved', data)
  //     //   setUnsaved(data)
  //     //   break
  //     // }
  //   }
  // }

  const nativeRouteHandler = () => ({
    '/login': () => logout()
  })

  return (
    <HyloWebView
      ref={webViewRef}
      {...sourceOrPath}
      // messageHandler={messageHandler}
      nativeRouteHandler={nativeRouteHandler}
    />
  )
}
