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
import './webViewDebugUtils' // Import debug utilities in development
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
  const [loadError, setLoadError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionRecoveryAttempted, setSessionRecoveryAttempted] = useState(false)
  const [showSessionRecovery, setShowSessionRecovery] = useState(false)
  const retryCountRef = useRef(0)
  const nativeRouteHandler = nativeRouteHandlerProp || useNativeRouteHandler()
  const { postId, path: routePath, originalLinkingPath } = useRouteParams()
  const path = pathProp || routePath || originalLinkingPath || ''
  const uri = (source?.uri || `${Config.HYLO_WEB_BASE_URL}${path}`) + (postId ? `?postId=${postId}` : '')
  const { isAuthenticated, isAuthorized, checkAuth, logout } = useAuth()
  const openURL = useOpenURL()

  const customStyle = `${baseCustomStyle}${providedCustomStyle}`

  // Component-level debugging removed for production

  // Monitor auth state changes and reset recovery state when auth is restored
  useEffect(() => {
    if (isAuthenticated && sessionRecoveryAttempted) {
      setSessionRecoveryAttempted(false)
      setLoadError(null)
      setShowSessionRecovery(false)
    }
  }, [isAuthenticated, sessionRecoveryAttempted])

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

  // Session recovery function - attempts to refresh authentication
  const attemptSessionRecovery = useCallback(async () => {
    if (sessionRecoveryAttempted) {
      return false
    }

    setSessionRecoveryAttempted(true)

    try {
      // First, check if user is still authenticated
      await checkAuth()
      
      // Wait a moment for auth state to update
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Try to get session cookie again
      const newCookie = await getSessionCookie()
      
      if (newCookie) {
        setCookie(newCookie)
        setLoadError(null)
        return true
      } else {
        return false
      }
    } catch (error) {
      return false
    }
  }, [sessionRecoveryAttempted, checkAuth])

  // WebView recovery function
  const attemptRecovery = useCallback(async () => {
    if (retryCountRef.current >= 3) {
      return
    }

    retryCountRef.current += 1

    try {
      // Clear and refresh session cookie
      await clearSessionCookie()
      const newCookie = await getSessionCookie()
      setCookie(newCookie)
      setLoadError(null)
      setIsLoading(true)
      
      // Force WebView reload if ref is available
      if (webViewRef?.current?.reload) {
        webViewRef.current.reload()
      }
    } catch (error) {
      setLoadError({ type: 'RECOVERY_FAILED', message: 'Unable to recover WebView state' })
    }
  }, [uri, webViewRef])

  // WebView event handlers
  const handleLoadStart = useCallback(() => {
    setIsLoading(true)
    setLoadError(null)
  }, [])

  const handleLoadEnd = useCallback((event) => {
    setIsLoading(false)
    retryCountRef.current = 0 // Reset retry count on successful load
  }, [])

  const handleError = useCallback((event) => {
    const { nativeEvent } = event
    setIsLoading(false)
    
    const errorInfo = {
      type: 'LOAD_ERROR',
      message: nativeEvent.description || 'WebView failed to load',
      code: nativeEvent.code,
      url: nativeEvent.url || uri
    }
    
    setLoadError(errorInfo)

    // Attempt automatic recovery for certain error types
    if (nativeEvent.code !== -999) { // Don't retry for cancelled requests
      setTimeout(attemptRecovery, 2000)
    }
  }, [uri, attemptRecovery])

  const handleHttpError = useCallback((event) => {
    const { nativeEvent } = event
    setIsLoading(false)
    
    const errorInfo = {
      type: 'HTTP_ERROR',
      message: `HTTP ${nativeEvent.statusCode}: ${nativeEvent.description || 'Unknown error'}`,
      statusCode: nativeEvent.statusCode,
      url: nativeEvent.url || uri
    }
    
    setLoadError(errorInfo)

    // Attempt recovery for server errors (5xx) but not client errors (4xx)
    if (nativeEvent.statusCode >= 500) {
      setTimeout(attemptRecovery, 3000)
    }
  }, [uri, attemptRecovery])

  const handleContentProcessDidTerminate = useCallback(() => {
    setLoadError({ type: 'PROCESS_TERMINATED', message: 'WebView content process was terminated' })
    attemptRecovery()
  }, [attemptRecovery])

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
      case 'CONTENT_CHECK_RESPONSE':
      case 'INITIAL_CONTENT_CHECK':
      case 'CONTENT_STATUS_UPDATE':
      case 'FALLBACK_CONTENT_CHECK': {
        // Content check responses processed silently
        break
      }
      case 'DEBUG_AVAILABILITY_RESPONSE': {
        // Debug response processed silently
        break
      }
      case 'DEBUG_TEST': {
        // Debug test processed silently  
        break
      }
      case 'DEBUG_UTILITIES_LOADED': {
        // Debug utilities loaded silently
        break
      }
      case 'DIAGNOSTIC_RESULT': {
        // Diagnostic results processed silently
        break
      }
      case 'DEBUG_UTILITIES_MISSING': {
        // Force a reload to reinject the custom script
        if (webViewRef?.current?.reload) {
          setTimeout(() => webViewRef.current.reload(), 100)
        }
        break
      }
    }

    messageHandler && messageHandler(parsedMessage)
  }

  // Render loading/error states for better debugging
  if (loadError && __DEV__) {
    return (
      <View className="p-5 bg-red-50 border border-destructive rounded m-2.5">
        <Text className="text-destructive text-lg font-bold mb-2.5">
          WebView Error ({loadError.type})
        </Text>
        <Text className="text-foreground mb-2.5">{loadError.message}</Text>
        <Text className="text-xs text-muted-foreground mb-4">
          URI: {uri}
        </Text>
        <TouchableOpacity 
          onPress={attemptRecovery}
          className="bg-secondary p-3 rounded items-center"
        >
          <Text className="text-secondary-foreground font-bold">
            Retry ({retryCountRef.current}/3)
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!cookie || !uri) {
    if (showSessionRecovery) {
      // Show session recovery interface
      return (
        <View className="flex-1 bg-background p-5 justify-center">
          <View className="bg-card p-5 rounded-lg shadow-sm border border-border">
            <Text className="text-xl font-bold mb-4 text-center text-card-foreground">
              🔐 Session Required
            </Text>
            
            <Text className="text-base mb-5 text-center text-muted-foreground leading-6">
              This content requires authentication. Your session may have expired or been reset.
            </Text>
            
            {!sessionRecoveryAttempted && (
              <>
                <TouchableOpacity 
                  onPress={async () => {
                    const success = await attemptSessionRecovery()
                    if (success) {
                      // Cookie will be set and component will re-render
                      return
                    }
                  }}
                  className="bg-secondary p-4 rounded-md items-center mb-3"
                >
                  <Text className="text-secondary-foreground font-bold text-base">
                    🔄 Refresh Session
                  </Text>
                </TouchableOpacity>
                
                <Text className="text-sm text-center text-muted-foreground mb-4">
                  Try refreshing your authentication first
                </Text>
              </>
            )}
            
            {sessionRecoveryAttempted && (
              <>
                <Text className="text-sm text-center text-destructive mb-4">
                  Session refresh failed. You need to log in again :(
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
                  className="bg-accent p-4 rounded-md items-center mb-3"
                >
                  <Text className="text-accent-foreground font-bold text-base">
                    🔑 Log Out & Re-authenticate
                  </Text>
                </TouchableOpacity>
              </>
            )}
            
            {__DEV__ && (
              <>
                <View className="h-px bg-border my-4" />
                <Text className="text-xs text-center text-muted-foreground mb-3">
                  Developer Tools
                </Text>
                
                <TouchableOpacity 
                  onPress={() => {
                    if (global.webViewDebugUtils) {
                      global.webViewDebugUtils.testCookieSystem()
                    }
                  }}
                  className="bg-yellow-500 p-2.5 rounded items-center mb-2"
                >
                  <Text className="text-yellow-900 font-bold text-xs">
                    🔍 Debug Session State
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={async () => {
                    if (global.webViewDebugUtils) {
                      await global.webViewDebugUtils.clearWebViewState()
                      // Attempt to refresh the session after clearing
                      setTimeout(async () => {
                        const newCookie = await getSessionCookie()
                        setCookie(newCookie)
                      }, 500)
                    }
                  }}
                  className="bg-destructive p-2.5 rounded items-center mb-2"
                >
                  <Text className="text-destructive-foreground font-bold text-xs">
                    🗑️ Clear Session Data
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={async () => {
                    try {
                      await clearSessionCookie()
                      await logout()
                    } catch (error) {
                      // Force logout failed - handled silently
                    }
                  }}
                  className="bg-purple-600 p-2.5 rounded items-center"
                >
                  <Text className="text-white font-bold text-xs">
                    🚪 Force Logout (Debug)
                  </Text>
                </TouchableOpacity>
              </>
            )}
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
        
        // Add debugging utilities in development
        ${__DEV__ ? `
          window.HyloWebViewDebug = {
            logInfo: () => {
              console.log('HyloWebView Debug Info:', {
                userAgent: navigator.userAgent,
                url: window.location.href,
                timestamp: new Date().toISOString(),
                cookies: document.cookie,
                localStorage: Object.keys(localStorage).length,
                sessionStorage: Object.keys(sessionStorage).length
              });
            },
            testCommunication: () => {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DEBUG_TEST',
                data: { timestamp: Date.now(), status: 'OK' }
              }));
            },
            checkContent: () => {
              const bodyContent = document.body ? document.body.innerHTML.substring(0, 200) : 'No body';
              const hasReactRoot = !!document.querySelector('#root, [data-reactroot], .react-root');
              const scriptTags = document.querySelectorAll('script').length;
              const styleTags = document.querySelectorAll('link[rel="stylesheet"], style').length;
              const errorElements = document.querySelectorAll('.error, .error-message, [class*="error"]');
              
              return {
                title: document.title,
                bodyLength: document.body ? document.body.innerHTML.length : 0,
                bodyPreview: bodyContent,
                hasReactRoot,
                scriptTags,
                styleTags,
                errorElements: errorElements.length,
                readyState: document.readyState,
                domContentLoaded: document.readyState === 'complete'
              };
            }
          };
          
          // Listen for content check requests from React Native
          window.addEventListener('message', (event) => {
            try {
              const message = JSON.parse(event.data);
              
              if (message.type === 'DEBUG_AVAILABILITY_CHECK') {
                // Respond that debug utilities are available
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG_AVAILABILITY_RESPONSE',
                  timestamp: Date.now(),
                  requestTimestamp: message.timestamp
                }));
                return;
              }
              
              if (message.type === 'CONTENT_CHECK_REQUEST') {
                if (window.HyloWebViewDebug && window.HyloWebViewDebug.checkContent) {
                  const contentInfo = window.HyloWebViewDebug.checkContent();
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'CONTENT_CHECK_RESPONSE',
                    data: contentInfo,
                    requestTimestamp: message.timestamp
                  }));
                } else {
                  // Debug utilities are missing - notify React Native
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'DEBUG_UTILITIES_MISSING',
                    timestamp: Date.now(),
                    requestTimestamp: message.timestamp
                  }));
                }
              }
            } catch (e) {
              // Ignore parsing errors for non-JSON messages
            }
          });
          
          // Monitor for significant DOM changes
          let contentCheckTimeout;
          const checkContentAfterDelay = () => {
            clearTimeout(contentCheckTimeout);
            contentCheckTimeout = setTimeout(() => {
              const contentInfo = window.HyloWebViewDebug.checkContent();
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'CONTENT_STATUS_UPDATE',
                data: contentInfo
              }));
            }, 2000); // Check content 2 seconds after last change
          };
          
          // Watch for DOM changes that might indicate rendering issues
          if (document.body) {
            const observer = new MutationObserver(checkContentAfterDelay);
            observer.observe(document.body, { childList: true, subtree: true });
          } else {
            document.addEventListener('DOMContentLoaded', () => {
              if (document.body) {
                const observer = new MutationObserver(checkContentAfterDelay);
                observer.observe(document.body, { childList: true, subtree: true });
              }
              checkContentAfterDelay();
            });
          }
          
          // Initialize debug utilities silently
          const loadId = 'load_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          window.hyloWebViewLoadId = loadId;
          
          // Notify React Native that debug utilities are loaded
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEBUG_UTILITIES_LOADED',
            loadId: loadId,
            timestamp: Date.now(),
            url: window.location.href
          }));
          
          // Do initial content check after a short delay
          setTimeout(() => {
            if (window.HyloWebViewDebug && window.HyloWebViewDebug.checkContent) {
              const contentInfo = window.HyloWebViewDebug.checkContent();
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'INITIAL_CONTENT_CHECK',
                data: { ...contentInfo, loadId: loadId }
              }));
            }
          }, 1000);
        ` : ''}
      `}
      customStyle={customStyle}
      geolocationEnabled
      onMessage={handleMessage}
      nestedScrollEnabled
      hideKeyboardAccessoryView
      webviewDebuggingEnabled
      // Error handling props
      onLoadStart={handleLoadStart}
      onLoadEnd={handleLoadEnd}
      onError={handleError}
      onHttpError={handleHttpError}
      onContentProcessDidTerminate={handleContentProcessDidTerminate}
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
