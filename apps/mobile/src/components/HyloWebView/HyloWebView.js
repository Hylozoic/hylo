import React, { useCallback, useState, useEffect } from 'react'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import Config from 'react-native-config'
import useRouteParams from 'hooks/useRouteParams'
import AutoHeightWebView from 'react-native-autoheight-webview'
import queryString from 'query-string'
import { WebViewMessageTypes } from '@hylo/shared'
import useOpenURL from 'hooks/useOpenURL'
import { modalScreenName } from 'hooks/useIsModalScreen'
import { getSessionCookie } from 'util/session'
import { match, pathToRegexp } from 'path-to-regexp'
import { parseWebViewMessage } from '.'

export const useNativeRouteHandler = () => {
  const navigation = useNavigation()
  const openURL = useOpenURL()

  return ({ pathname, search }) => ({
    '(.*)/:type(post|members)/:id': ({ routeParams }) => {
      const { type, id } = routeParams

      switch (type) {
        case 'post': {
          navigation.navigate('Post Details', { id })
          break
        }
        case 'members': {
          navigation.navigate('Member', { id })
          break
        }
      }
    },
    '(.*)/post/:postId/edit': ({ routeParams }) => {
      navigation.navigate('Edit Post', { id: routeParams.postId })
    },
    '(.*)/group/:groupSlug([a-zA-Z0-9-]+)': ({ routeParams }) => {
      navigation.navigate(modalScreenName('Group Explore'), routeParams)
    },
    '/:groupSlug(all)/topics/:topicName': ({ routeParams: { topicName } }) => {
      navigation.navigate('Stream', { topicName })
    },
    '(.*)/topics/:topicName': ({ routeParams: { topicName } }) => {
      navigation.navigate('Stream', { topicName })
    },
    '(.*)/chats/:topicName': ({ routeParams: { topicName } }) => {
      navigation.navigate('Chat Room', { topicName })
    },
    '(.*)': () => {
      openURL(pathname + search)
    }
  })
}

const handledWebRoutesJavascriptCreator = loadedPath => allowRoutesParam => {
  const handledWebRoutes = [loadedPath, ...allowRoutesParam]
  const handledWebRoutesRegExps = handledWebRoutes.map(allowedRoute => pathToRegexp(allowedRoute))
  const handledWebRoutesRegExpsLiteralString = JSON.parse(JSON.stringify(handledWebRoutesRegExps.map(a => a.toString())))

  return `
    window.addHyloWebViewListener = function (history) {
      if (history) {
        history.listen(({ location: { pathname, search } }) => {
          const handledWebRoutesRegExps = [${handledWebRoutesRegExpsLiteralString}]
          const handled = handledWebRoutesRegExps.some(allowedRoutePathRegExp => {
            return allowedRoutePathRegExp.test(pathname);
          })

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: '${WebViewMessageTypes.NAVIGATION}',
            data: { handled, pathname, search }
          }))

          history.back();
        })
      }
    }
  `
}

// CSS to inject into WebView to fix scrollbar issues
const injectedCSS = `
  ::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  
  html, body {
    overflow: hidden;
    overflow-y: hidden;
    overflow-x: hidden;
    width: 100%;
    margin: 0;
    padding: 0;
  }
  
  body {
    width: 100vw !important;
    position: fixed !important;
    left: 0 !important;
    right: 0 !important;
    max-width: 100% !important;
  }
`

const HyloWebView = React.forwardRef(({
  handledWebRoutes = [],
  messageHandler,
  nativeRouteHandler: nativeRouteHandlerProp,
  path: pathProp,
  style,
  source,
  customStyle = '',
  ...forwardedProps
}, webViewRef) => {
  const [cookie, setCookie] = useState()
  const [uri, setUri] = useState()
  const { postId, path: routePath, originalLinkingPath } = useRouteParams()
  const nativeRouteHandler = nativeRouteHandlerProp || useNativeRouteHandler()

  const path = pathProp || routePath || originalLinkingPath || ''

  useEffect(() => {
    setUri((source?.uri || `${Config.HYLO_WEB_BASE_URL}${path}`) + (postId ? `?postId=${postId}` : ''))
  }, [source?.uri, pathProp, routePath, originalLinkingPath])

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
            const searchParams = queryString.parse(search)

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

  if (!cookie || !uri) return null

  return (
    <AutoHeightWebView
      customScript={`
        window.HyloWebView = true;
        ${path && handledWebRoutesJavascriptCreator(path)(handledWebRoutes)}
      `}
      customStyle={`${injectedCSS}${customStyle}`}
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
        'http://localhost*',
        'https://www.youtube.com',
        'https://*.youtube.com',
        'https://*.vimeo.com',
        'https://*.soundcloud.com'
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
        minHeight: 1,
        width: '100%' // Ensure the WebView takes full width
      }]}
      // Recommended setting from AutoHeightWebView docs, with disclaimer about a
      // potential Android issue. It helpfully disables iOS zoom feature.
      viewportContent='width=device-width, user-scalable=no, initial-scale=1, maximum-scale=1'
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      {...forwardedProps}
    />
  )
})

export default HyloWebView
