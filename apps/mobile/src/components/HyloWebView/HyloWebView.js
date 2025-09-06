import React, { useCallback, useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import Config from 'react-native-config'
import useRouteParams from 'hooks/useRouteParams'
import AutoHeightWebView from 'react-native-autoheight-webview'
import queryString from 'query-string'
import { WebViewMessageTypes } from '@hylo/shared'
import useOpenURL from 'hooks/useOpenURL'
import { modalScreenName } from 'hooks/useIsModalScreen'
import { getSessionCookie, clearSessionCookie } from 'util/session'
import { match, pathToRegexp } from 'path-to-regexp'
import { parseWebViewMessage } from '.'
import { useAuth } from '@hylo/contexts/AuthContext'

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

const handledWebRoutesJavascriptCreator = (handledWebRoutes) => {
  const handledWebRoutesRegExps = handledWebRoutes.map(handledWebRoute => pathToRegexp(handledWebRoute))
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

/* Should probably just be applied to Hylo Web stylesheet 
  as what this solves is not necessarily WebView specific, 
  but putting here for now to limit possible untested impact
  on Hylo Web generally */
const baseCustomStyle = `
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
  customStyle: providedCustomStyle = '',
  ...forwardedProps
}, webViewRef) => {
  const [cookie, setCookie] = useState()
  const [isLoading, setIsLoading] = useState(true)
  const [showSessionRecovery, setShowSessionRecovery] = useState(false)
  const nativeRouteHandler = nativeRouteHandlerProp || useNativeRouteHandler()
  const { postId, path: routePath, originalLinkingPath } = useRouteParams()
  const path = pathProp || routePath || originalLinkingPath || ''
  const uri = (source?.uri || `${Config.HYLO_WEB_BASE_URL}${path}`) + (postId ? `?postId=${postId}` : '')
  const { isAuthenticated, isAuthorized, checkAuth, logout } = useAuth()
  const openURL = useOpenURL()

  const customStyle = `${baseCustomStyle}${providedCustomStyle}`

  // Monitor auth state changes and reset recovery state when auth is restored
  useEffect(() => {
    if (isAuthenticated) {
      setLoadError(null)
      setShowSessionRecovery(false)
    }
  }, [isAuthenticated])

  // Only show session recovery after a delay to prevent flashing
  useEffect(() => {
    let timer
    if (!cookie && !isLoading) {
      timer = setTimeout(() => {
        setShowSessionRecovery(true)
      }, 2000) // Wait 2 seconds before showing recovery UI
    } else {
      setShowSessionRecovery(false)
    }
    
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [cookie, isLoading])

  // Clear error state when component re-focuses
  useFocusEffect(
    useCallback(() => {
      const getCookieAsync = async () => {
        try {
        const newCookie = await getSessionCookie()
        setCookie(newCookie)
          setLoadError(null) // Clear any previous error
        } catch (error) {
          setLoadError({ type: 'COOKIE_ERROR', message: 'Failed to retrieve session cookie' })
        }
      }
      getCookieAsync()
    }, [])
  )



  // WebView event handlers
  const handleLoadStart = useCallback(() => {
    setIsLoading(true)
  }, [])

  const handleLoadEnd = useCallback((event) => {
    setIsLoading(false)
  }, [])


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
        break
      }
    }

    messageHandler && messageHandler(parsedMessage)
  }


  if (!cookie || !uri) {
    if (showSessionRecovery) {
      // Show simple session recovery interface
      return (
        <View className="flex-1 bg-background p-5 justify-center">
          <View className="bg-card p-5 rounded-lg shadow-sm border border-border">
            <Text className="text-xl font-bold mb-4 text-center text-card-foreground">
              🔐 Session Required
            </Text>
            
            <Text className="text-base mb-5 text-center text-muted-foreground leading-6">
              Your session has expired. Please log out and log back in to continue.
            </Text>
            
            <TouchableOpacity 
              onPress={async () => {
                try {
                  // Clear the session and trigger logout
                  await clearSessionCookie() 
                  await logout()
                  // The auth state change will automatically navigate to login
                } catch (error) {
                  // Fallback: try direct navigation to login without reset
                  openURL('/login')
                }
              }}
              className="bg-accent p-4 rounded-md items-center"
            >
              <Text className="text-accent-foreground font-bold text-base">
                🔑 Log Out & Log Back In
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )
    }
    return null
  }

  return (
    <AutoHeightWebView
      customScript={`
        window.HyloWebView = true;
        ${path && handledWebRoutesJavascriptCreator([path, ...handledWebRoutes])}
        
      `}
      customStyle={customStyle}
      geolocationEnabled
      onMessage={handleMessage}
      nestedScrollEnabled
      hideKeyboardAccessoryView
      onLoadStart={handleLoadStart}
      onLoadEnd={handleLoadEnd}
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
      {...forwardedProps}
    />
  )
})

export default HyloWebView
