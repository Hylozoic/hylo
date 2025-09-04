import React, { useState, useEffect } from 'react'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import HyloWebView from 'components/HyloWebView'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import WebViewDebugFallback from 'components/HyloWebView/WebViewDebugFallback'

export const DEFAULT_CHAT_TOPIC = 'general'

export default function ChatRoomWebView () {
  const [{ currentGroup, fetching }] = useCurrentGroup()
  const { topicName: routeTopicName } = useRouteParams()
  const topicName = routeTopicName || DEFAULT_CHAT_TOPIC
  const path = `/groups/${currentGroup?.slug}/chat/${topicName}`
  const [webViewRendered, setWebViewRendered] = useState(false)

  // Track if WebView successfully renders
  useEffect(() => {
    const timer = setTimeout(() => {
      // Silent timeout - no logging
    }, 3000)
    
    return () => clearTimeout(timer)
  }, [webViewRendered])

  if (!currentGroup?.slug || fetching) return null

  return (
    <KeyboardFriendlyView style={{ flex: 1 }}>
      <HyloWebView 
        path={path}
        onLoadStart={() => {
          setWebViewRendered(true)
        }}
      />
      
      {/* Debug fallback that shows if WebView fails */}
      {__DEV__ && !webViewRendered && (
        <WebViewDebugFallback 
          message="Chat WebView failed to render or load"
          onPress={() => {
            // Debug info logged silently
          }}
        />
      )}
    </KeyboardFriendlyView>
  )
}
