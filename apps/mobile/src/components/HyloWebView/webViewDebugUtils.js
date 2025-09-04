// Development-only utilities for debugging WebView issues
import { clearSessionCookie, getSessionCookie } from 'util/session'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const webViewDebugUtils = {
  // Log current WebView state
  logWebViewState: async () => {
    if (!__DEV__) return

    try {
      const cookie = await getSessionCookie()
      const allKeys = await AsyncStorage.getAllKeys()
      const storage = await AsyncStorage.multiGet(allKeys)
      
      console.log('=== WebView Debug State ===')
      console.log('Session Cookie:', cookie ? 'Present' : 'Missing')
      console.log('AsyncStorage Keys:', allKeys.length)
      console.log('Storage Contents:', Object.fromEntries(storage))
      console.log('=========================')
    } catch (error) {
      console.warn('Error logging WebView state:', error)
    }
  },

  // Force clear all WebView related state
  clearWebViewState: async () => {
    if (!__DEV__) return

    try {
      console.log('Clearing WebView state...')
      await clearSessionCookie()
      
      // Clear other potential state that might affect WebViews
      const keys = await AsyncStorage.getAllKeys()
      const webViewKeys = keys.filter(key => 
        key.includes('webview') || 
        key.includes('cookie') || 
        key.includes('session')
      )
      
      if (webViewKeys.length > 0) {
        await AsyncStorage.multiRemove(webViewKeys)
        console.log('Cleared WebView keys:', webViewKeys)
      }
      
      console.log('WebView state cleared successfully')
    } catch (error) {
      console.warn('Error clearing WebView state:', error)
    }
  },

  // Test WebView cookie functionality
  testCookieSystem: async () => {
    if (!__DEV__) return

    try {
      console.log('=== COOKIE SYSTEM DIAGNOSIS ===')
      
      // Check current cookie
      const currentCookie = await getSessionCookie()
      console.log('Current cookie:', currentCookie ? 'present' : 'missing')
      console.log('Cookie details:', {
        length: currentCookie ? currentCookie.length : 0,
        type: typeof currentCookie,
        preview: currentCookie ? currentCookie.substring(0, 100) + '...' : 'null'
      })
      
      // Check AsyncStorage directly
      const allKeys = await AsyncStorage.getAllKeys()
      const cookieKeys = allKeys.filter(key => 
        key.includes('cookie') || 
        key.includes('session') ||
        key.includes('hylo')
      )
      console.log('Storage keys related to cookies/session:', cookieKeys)
      
      if (cookieKeys.length > 0) {
        const cookieData = await AsyncStorage.multiGet(cookieKeys)
        console.log('Cookie-related storage data:', Object.fromEntries(cookieData))
      }
      
      console.log('Cookie system diagnosis completed')
    } catch (error) {
      console.warn('Cookie system test failed:', error)
    }
  },

  // Force set a test cookie to see if that fixes the issue
  forceTestCookie: async () => {
    if (!__DEV__) return

    try {
      console.log('Setting test cookie...')
      const testCookie = 'test_cookie=test_value; Path=/; HttpOnly'
      await AsyncStorage.setItem('hylo_session_cookie', testCookie)
      
      const retrieved = await getSessionCookie()
      console.log('Test cookie set and retrieved:', retrieved)
      
      return retrieved
    } catch (error) {
      console.warn('Failed to set test cookie:', error)
    }
  },

  // Manually trigger content check on a WebView ref
  checkWebViewContent: (webViewRef) => {
    if (!__DEV__ || !webViewRef?.current) return

    console.log('Triggering manual content check...')
    webViewRef.current.postMessage(JSON.stringify({
      type: 'CONTENT_CHECK_REQUEST',
      timestamp: Date.now(),
      manual: true
    }))
  },

  // Force reload a WebView ref
  reloadWebView: (webViewRef) => {
    if (!__DEV__ || !webViewRef?.current) return

    console.log('Forcing WebView reload...')
    webViewRef.current.reload()
  },

  // Test if WebView debug utilities are responding
  testWebViewConnection: (webViewRef) => {
    if (!__DEV__ || !webViewRef?.current) return

    console.log('Testing WebView connection...')
    
    // Send a test message
    webViewRef.current.postMessage(JSON.stringify({
      type: 'DEBUG_AVAILABILITY_CHECK',
      timestamp: Date.now(),
      test: true
    }))
    
    // If no response after 3 seconds, assume connection is broken
    setTimeout(() => {
      console.log('If you did not see "Debug utilities are available and responding" above, the WebView connection is broken')
    }, 3000)
  },

  // Inject debug script manually (as a last resort)
  injectDebugScript: (webViewRef) => {
    if (!__DEV__ || !webViewRef?.current) return

    console.log('Manually injecting debug script...')
    
    const debugScript = `
      if (!window.HyloWebViewDebug) {
        console.log('Manually creating HyloWebViewDebug utilities');
        window.HyloWebViewDebug = {
          checkContent: () => {
            const bodyContent = document.body ? document.body.innerHTML.substring(0, 200) : 'No body';
            const hasReactRoot = !!document.querySelector('#root, [data-reactroot], .react-root');
            return {
              title: document.title,
              bodyLength: document.body ? document.body.innerHTML.length : 0,
              bodyPreview: bodyContent,
              hasReactRoot,
              manualInjection: true
            };
          }
        };
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG_SCRIPT_MANUALLY_INJECTED',
          timestamp: Date.now()
        }));
      }
    `
    
    webViewRef.current.injectJavaScript(debugScript)
  },

  // Comprehensive diagnosis of WebView state
  diagnoseWebView: (webViewRef) => {
    if (!__DEV__ || !webViewRef?.current) return

    console.log('=== COMPREHENSIVE WEBVIEW DIAGNOSIS ===')
    
    // Test basic connection
    console.log('1. Testing basic WebView connection...')
    webViewRef.current.postMessage(JSON.stringify({
      type: 'DEBUG_AVAILABILITY_CHECK', 
      timestamp: Date.now(),
      diagnosis: true
    }))
    
    setTimeout(() => {
      console.log('2. Attempting manual script injection...')
      const diagnosticScript = `
        (function() {
          console.log('=== WEBVIEW DIAGNOSTIC SCRIPT ===');
          console.log('URL:', window.location.href);
          console.log('Title:', document.title);
          console.log('ReadyState:', document.readyState);
          console.log('Body exists:', !!document.body);
          console.log('Body length:', document.body ? document.body.innerHTML.length : 0);
          console.log('React root exists:', !!document.querySelector('#root, [data-reactroot], .react-root, [id*="root"]'));
          console.log('Error elements:', document.querySelectorAll('.error, .error-message, [class*="error"]').length);
          console.log('Script tags:', document.querySelectorAll('script').length);
          console.log('Style tags:', document.querySelectorAll('link[rel="stylesheet"], style').length);
          
          // Check for loading/spinner elements
          console.log('Loading indicators:', document.querySelectorAll('.loading, .spinner, [class*="loading"], [class*="spinner"]').length);
          
          // Check for common issues
          const issues = [];
          if (!document.body || document.body.innerHTML.length < 100) {
            issues.push('Empty or minimal body content');
          }
          if (!document.querySelector('#root, [data-reactroot], .react-root, [id*="root"]')) {
            issues.push('No React root element found');
          }
          if (document.title === 'Hylo' && window.location.href.includes('/chat/')) {
            issues.push('Generic title on chat page - rendering issue');
          }
          if (document.querySelectorAll('.loading, .spinner, [class*="loading"], [class*="spinner"]').length > 0) {
            issues.push('Page stuck on loading screen');
          }
          
          console.log('Issues detected:', issues);
          
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DIAGNOSTIC_RESULT',
              data: {
                url: window.location.href,
                title: document.title,
                bodyLength: document.body ? document.body.innerHTML.length : 0,
                hasReactRoot: !!document.querySelector('#root, [data-reactroot], .react-root, [id*="root"]'),
                loadingElements: document.querySelectorAll('.loading, .spinner, [class*="loading"], [class*="spinner"]').length,
                issues: issues,
                timestamp: Date.now()
              }
            }));
          }
        })();
      `
      
      webViewRef.current.injectJavaScript(diagnosticScript)
    }, 500)
  },

  // Quick diagnosis for loading screen issues
  diagnoseLodingIssue: async () => {
    if (!__DEV__) return

    console.log('=== LOADING SCREEN DIAGNOSIS ===')
    
    try {
      // Check auth state
      const { getState } = require('@hylo/contexts/AuthContext').useAuthStore
      const authState = getState()
      console.log('Auth state:', authState)
      
      // Check session cookie
      const currentCookie = await getSessionCookie()
      console.log('Current session cookie:', currentCookie ? 'present' : 'missing')
      
      // Check AsyncStorage state
      const allKeys = await AsyncStorage.getAllKeys()
      const authKeys = allKeys.filter(key => 
        key.includes('auth') || 
        key.includes('user') || 
        key.includes('session')
      )
      console.log('Auth-related storage keys:', authKeys)
      
      if (authKeys.length > 0) {
        const authData = await AsyncStorage.multiGet(authKeys)
        console.log('Auth storage data:', Object.fromEntries(authData))
      }
      
    } catch (error) {
      console.warn('Loading diagnosis failed:', error)
    }
  }
}

// Make utilities available globally in development
if (__DEV__) {
  global.webViewDebugUtils = webViewDebugUtils
}
