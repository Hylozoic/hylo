import React, { useRef } from 'react'
import HyloWebView from 'components/HyloWebView'
import RNRestart from 'react-native-restart'

export default function GroupSettingsWebView ({ path: pathProp, route }) {
  const webViewRef = useRef(null)
  const path = pathProp || route?.params?.path

  return (
    <HyloWebView
      ref={webViewRef}
      path={path}
      onNavigationStateChange={({ url }) => {
        // Temporary sorta fix for Group delete which reloads the page
        if (url.match(/\/all/)) {
          RNRestart.Restart()
          return false
        }
        if (!url.match(/\/groups\/([^\/]+)settings/)) {
          webViewRef.current?.goBack()
          return false
        }
      }}
    />
  )
}
