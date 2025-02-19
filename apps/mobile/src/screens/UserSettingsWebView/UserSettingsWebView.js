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
  // const [selectedSetting, setSelectedSetting] = useState(null)
  // TODO: URQL! - Untested, intention is to refresh cache
  const [, queryCurrentUser] = useCurrentUser({ requestPolicy: 'network-only', pause: true })
  const logout = useLogout()
  const { originalLinkingPath, settingsArea } = useRouteParams()

  const sourceOrPath = settingsArea === 'terms'
    ? { uri: TERMS_URL }
    : { path: originalLinkingPath }

  useFocusEffect(
    useCallback(() => {
      // onBlur
      return () => {
        queryCurrentUser()
      }
    }, [])
  )

  // TODO: The single case here currently, and likely most cases for this in the future
  // are mitigated by the above useFocusEffect / onBlur handler which re-queries currentUser
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
