import type { RefObject } from 'react'
import type { WebView } from 'react-native-webview'

export function sendMessageFromWebView (
  webViewRef: RefObject<WebView | null>,
  type: string,
  data?: unknown,
  delay?: number
) {
  if (!webViewRef) {
    throw new Error('The first parameter `webViewRef` is empty or not valid')
  }
  if (!type) {
    throw new Error('Must provide a message `type` when sending a message from the WebView')
  }

  const post = () => {
    webViewRef.current?.postMessage(JSON.stringify({ type, data }))
  }

  if (webViewRef.current?.postMessage) {
    if (delay) setTimeout(post, delay)
    else post()
  }
}
