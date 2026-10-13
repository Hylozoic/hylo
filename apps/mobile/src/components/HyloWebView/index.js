import component from './HyloWebView'

export function parseWebViewMessage (messageOrEvent) {
  return JSON.parse(messageOrEvent?.nativeEvent ? messageOrEvent.nativeEvent.data : messageOrEvent)
}

export function sendMessageFromWebView (webViewRef, type, data, delay) {
  if (!webViewRef) {
    throw new Error('The first parameter `webViewRef` is empty or not valid')
  }

  if (!type) {
    throw new Error('Must provide a message `type` when sending a message from the WebView')
  }

  if (webViewRef.current?.postMessage) {
    if (delay) {
      setTimeout(() => webViewRef.current.postMessage(JSON.stringify({ type, data })), delay)
    } else {
      webViewRef.current.postMessage(JSON.stringify({ type, data }))
    }
  }
}

export default component
