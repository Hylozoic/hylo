import React, { useRef } from 'react'
import { WebViewMessageTypes } from '@hylo/shared'
import useRouteParams from 'hooks/useRouteParams'
import HyloWebView from 'components/HyloWebView'
import useLogout from 'hooks/useLogout'
import useCurrentUser from 'urql-shared/hooks/useCurrentUser'

export default function UserSettingsWebView ({ path: pathProp, route }) {
  // TODO: URQL - Untested, intention is to refresh cache
  const [, queryCurrentUser] = useCurrentUser({ requestPolicy: 'network-only', pause: true })
  const webViewRef = useRef(null)
  const logout = useLogout()
  const { path: routePath } = useRouteParams()
  const path = pathProp || routePath
  const source = route?.params.uri && { uri: route?.params.uri }
  const sourceOrPath = source
    ? { source}
    : { path }

  const messageHandler = ({ type, data }) => {
    switch (type) {
      case WebViewMessageTypes.LEFT_GROUP: {
        if (data.groupId) {
          queryCurrentUser()
        }
      }

      // TODO: See https://github.com/Hylozoic/hylo-evo/tree/user-settings-webview-improvements
      // case 'USER_SETTINGS.SET_EDIT_PROFILE_UNSAVED': {
      //   console.log('!!! setting unsaved', data)
      //   setUnsaved(data)
      //   break
      // }
    }
  }

  const nativeRouteHandler = () => ({
    '/login': () => logout()
  })

  return (
    <HyloWebView
      ref={webViewRef}
      {...sourceOrPath}
      messageHandler={messageHandler}
      nativeRouteHandler={nativeRouteHandler}
    />
  )
}
