import type { WebViewMessageEvent } from 'react-native-webview'

export function parseWebViewMessage (messageOrEvent: WebViewMessageEvent | string) {
  const data = typeof messageOrEvent === 'string'
    ? messageOrEvent
    : messageOrEvent.nativeEvent.data
  return JSON.parse(data)
}
