import React, { useCallback, useState, useEffect } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import Config from 'react-native-config'
import Loading from 'components/Loading'
import useRouteParams from 'hooks/useRouteParams'
import AutoHeightWebView from 'react-native-autoheight-webview'
import QueryString from 'query-string'
import { WebViewMessageTypes } from '@hylo/shared'
import { getSessionCookie } from 'util/session'
import { match, pathToRegexp } from 'path-to-regexp'
import { parseWebViewMessage } from '.'

const handledWebRoutesJavascriptCreator = loadedPath => allowRoutesParam => {
  const handledWebRoutes = [loadedPath, ...allowRoutesParam]
  const handledWebRoutesRegExps = handledWebRoutes.map(allowedRoute => pathToRegexp(allowedRoute))
  const handledWebRoutesRegExpsLiteralString = JSON.parse(JSON.stringify(handledWebRoutesRegExps.map(a => a.toString())))

  return `
    if (window.ReactNativeWebView.reactRouterHistory) {
      window.ReactNativeWebView.reactRouterHistory.block(({ pathname, search }) => {
        const handledWebRoutesRegExps = [${handledWebRoutesRegExpsLiteralString}]
        const handled = handledWebRoutesRegExps.some(allowedRoutePathRegExp => {
          return allowedRoutePathRegExp.test(pathname)
        })

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: '${WebViewMessageTypes.NAVIGATION}',
          data: { handled, pathname, search }
        }))

        return handled
      })
    }
  `
}

const HyloWebView = React.forwardRef(({
  handledWebRoutes = [],
  messageHandler,
  nativeRouteHandler,
  path: pathProp,
  route,
  style,
  source,
  ...forwardedProps
}, webViewRef) => {
  const [cookie, setCookie] = useState()
  const [uri, setUri] = useState()
  const { postId, path: routePath } = useRouteParams()

  useEffect(() => {
    const path = pathProp || routePath
    setUri((source?.uri || `${Config.HYLO_WEB_BASE_URL}${path || ''}`) + (postId ? `?postId=${postId}` : ''))
  }, [source?.uri, pathProp, routePath])

  useFocusEffect(
    useCallback(() => {
      const getCookieAsync = async () => {
        const newCookie = await getSessionCookie()
        setCookie(newCookie)
      }
      getCookieAsync()
    }, [])
  )

  const handleMessage = message => {
    const parsedMessage = parseWebViewMessage(message)
    const { type, data } = parsedMessage

    switch (type) {
      case WebViewMessageTypes.NAVIGATION: {
        if (nativeRouteHandler) {
          const { handled, pathname, search } = data

          if (!handled) {
            const nativeRouteHandlers = nativeRouteHandler({ pathname, search })
            const searchParams = QueryString.parse(search)

            for (const pathMatcher in nativeRouteHandlers) {
              const matched = match(pathMatcher)(pathname)

              if (matched) {
                nativeRouteHandlers[pathMatcher]({
                  routeParams: matched.params,
                  pathname,
                  search,
                  searchParams
                })
                break
              }
            }
          }
        }
      }
    }

    messageHandler && messageHandler(parsedMessage)
  }

  if (!cookie) return <Loading />

  return (
    <AutoHeightWebView
      customScript={`
        window.HyloWebView = true;

        ${pathProp && handledWebRoutesJavascriptCreator(pathProp)(handledWebRoutes)}
      `}
      geolocationEnabled
      onMessage={handleMessage}
      nestedScrollEnabled
      hideKeyboardAccessoryView
      webviewDebuggingEnabled
      /*

      // NOTE: The following is deprecated in favor of listening for the WebView
      // post message type `WebViewMessageTypes.NAVIGATION` in combination with
      // overriding HyloWeb navigation events in HyloWeb when `window.ReactNativeWebView`
      // is true.

      onShouldStartLoadWithRequest={params => {
        const { url } = params

        // Opens full URLs in external browser if not the
        // initial URI specified on load of the WebView
        if (url === uri) return true
        if (url !== uri && url.slice(0, 4) === 'http') {
          Linking.openURL(url)
          return false
        }

        return onShouldStartLoadWithRequest(params)
      }}

      */
      originWhitelist={[
        'https://www.hylo*',
        'https://staging.hylo*',
        'http://localhost*'
      ]}
      ref={webViewRef}
      scalesPageToFit={false}
      // Needs to remain false for AutoHeight
      scrollEnabled={false}
      setSupportMultipleWindows={false}
      sharedCookiesEnabled
      source={{
        uri,
        headers: { cookie }
      }}
      style={[style, {
        // Avoids a known issue which can cause Android crashes
        // ref. https://github.com/iou90/react-native-autoheight-webview/issues/191
        opacity: 0.99,
        minHeight: 1
      }]}
      // Recommended setting from AutoHeightWebView docs, with disclaimer about a
      // potential Android issue. It helpfully disables iOS zoom feature.
      viewportContent='width=device-width, user-scalable=no'
      {...forwardedProps}
    />
  )
})

export default HyloWebView
