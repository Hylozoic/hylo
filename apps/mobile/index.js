import 'react-native-gesture-handler'
import { enableScreens } from 'react-native-screens'
import React, { useEffect, useState } from 'react'
import Config from 'react-native-config'
import { Provider as UrqlProvider } from 'urql'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { makeAsyncStorage } from '@urql/storage-rn'
import { Provider } from 'react-redux'
import { AppRegistry, Platform, AppState, UIManager } from 'react-native'
import Timer from 'react-native-background-timer'
import * as Sentry from '@sentry/react-native'
import { OneSignal } from 'react-native-onesignal'
import KeyboardManager from 'react-native-keyboard-manager'
import { AuthProvider } from '@hylo/contexts/AuthContext'
import mobileSubscriptionExchange from 'urql/mobileSubscriptionExchange'
import { useMakeUrqlClient } from '@hylo/urql/makeUrqlClient'
import { sentryConfig, isTest } from 'config'
import store from 'store'
import { name as appName } from './app.json'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { TRenderEngineProvider, defaultSystemFonts } from 'react-native-render-html'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import ErrorBoundary from 'screens/ErrorBoundary'
import VersionCheck from 'components/VersionCheck'
import RootNavigator from 'navigation/RootNavigator'
import { ToastProvider } from 'components/Toast'
import './i18n'
import { ActionSheetProvider } from '@expo/react-native-action-sheet'
import { baseStyle, tagsStyles, classesStyles } from 'components/HyloHTML/HyloHTML.styles'
import './src/style/global.css'

if (__DEV__) {
  require('./ReactotronConfig')
}

/* eslint-disable no-global-assign */

// For MSW, see https://mswjs.io/docs/integrations/react-native
async function enableMocking () {
  if (!isTest) {
    return
  }
  await import('./msw.polyfills')
  const { server } = await import('./src/graphql/mocks/mswServer')
  server.listen()
}
enableMocking().then(() => {
  AppRegistry.registerComponent(appName, () => App)
})

Sentry.init(sentryConfig)

// For Layout animation support: https://reactnative.dev/docs/layoutanimation
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

if (Platform.OS === 'android') {
  // We get these long polling warnings in development, which can actually cause
  // problems in production.  Here's a workaround.
  // https://github.com/facebook/react-native/issues/12981
  setTimeout = (fn, ms = 0) => Timer.setTimeout(fn, ms)
  setInterval = (fn, ms = 0) => Timer.setInterval(fn, ms)
  clearTimeout = (fn, ms = 0) => Timer.clearTimeout(fn, ms)
  clearInterval = (fn, ms = 0) => Timer.clearInterval(fn, ms)
}

AppRegistry.registerComponent(appName, () => App)

// Turning of this warning/error suppression for now as "arg[0].includes(error)" was failing and then swallowing errors
// if (__DEV__) {
//   // 2025.01.11 - This currently only suppressed defaultProps error from react-native-render-html
//   // This error is actually a deprecation warning, and has no material impact at our
//   // current version of React Native 0.74.5. However, may become actual issue in upgrades.
//   // Library lost its maintainer and is currently, track progress of migration here:
//   // https://github.com/meliorence/react-native-render-html/issues/674
//   const ignoreErrors = ["Support for defaultProps will be removed"];

//   const error = console.error;
//   console.error = (...arg) => {
//     for (const error of ignoreErrors) if (arg[0].includes(error)) return;
//     error(...arg);
//   };

//   LogBox.ignoreLogs(ignoreErrors);

//   // Ignore warning coming from React Navigation and Navigation.reset
//   // See: https://github.com/react-navigation/react-navigation/issues/11564#issuecomment-2433008812
//   LogBox.ignoreLogs(['Sending `onAnimatedValueUpdate` with no listeners registered.']);
// }

enableScreens()

// TODO: Enable and test/fix all keyboard + ScrollView usages currently only used by GroupWelcome
// ref. https://github.com/douglasjunior/react-native-keyboard-manager/tree/main
if (Platform.OS === 'ios') {
  KeyboardManager.setEnable(false)
  KeyboardManager.setEnableAutoToolbar(false)
  KeyboardManager.setLayoutIfNeededOnUpdate(true)
  KeyboardManager.setShouldResignOnTouchOutside(true)
}

// Useful to debug in dev to diagnose any potential image loading issues,
// or simply to start fresh:
// FastImage.clearDiskCache()
// FastImage.clearMemoryCache()

// URQL debug (WIP)
// const { unsubscribe } = client.subscribeToDebugTarget(event => {
//   if (event.source === 'cacheExchange') {
//     return
//   }
//   console.log(event) // { type, message, operation, data, source, timestamp }
// })

export default function App () {
  const [appState, setAppState] = useState(AppState.currentState)
  const storage = makeAsyncStorage({ storage: AsyncStorage })
  const urqlClient = useMakeUrqlClient({
    subscriptionExchange: mobileSubscriptionExchange,
    storage
  })

  useEffect(() => {
    if (urqlClient) {
      OneSignal.initialize(Config.ONESIGNAL_APP_ID)

      // Uncomment for OneSignal debugging
      // OneSignal.Debug.setLogLevel(LogLevel.Verbose);

      // Method for handling notifications received while app in foreground
      const foregroundWillDisplayHandler = event => {
        event.preventDefault()
        console.log('foreground notification received:', event.notification)
      }
      OneSignal.Notifications.addEventListener('foregroundWillDisplay', foregroundWillDisplayHandler)

      const appStateHandler = AppState.addEventListener('change', handleAppStateChange)

      return () => {
        appStateHandler && appStateHandler.remove()
        OneSignal.Notifications.removeEventListener('foregroundWillDisplay', foregroundWillDisplayHandler)
      }
    }
  }, [urqlClient])

  const handleAppStateChange = nextAppState => {
    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      OneSignal.Notifications.clearAll()
    }
    setAppState(nextAppState)
  }

  if (!urqlClient) return null

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <ErrorBoundary>
          <UrqlProvider value={urqlClient}>
            <AuthProvider>
              <ActionSheetProvider>
                {/*
                  `TRenderEngineProvider` is the react-native-render-html rendering engine.
                  It is app-wide for performance reasons. The styles applied are global and
                  not readily overridden. For more details see: https://bit.ly/3MeJCIR
                */}
                <TRenderEngineProvider
                  baseStyle={baseStyle}
                  tagsStyles={tagsStyles}
                  classesStyles={classesStyles}
                  systemFonts={[...defaultSystemFonts, 'Circular-Book']}
                >
                  <Provider store={store}>
                    <ToastProvider>
                      <VersionCheck />
                      <RootNavigator />
                    </ToastProvider>
                  </Provider>
                </TRenderEngineProvider>
              </ActionSheetProvider>
            </AuthProvider>
          </UrqlProvider>
        </ErrorBoundary>
      </KeyboardProvider>
    </SafeAreaProvider>
  )
}
