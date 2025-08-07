import 'react-native-gesture-handler'
import { enableScreens } from 'react-native-screens'
import React, { useEffect, useState, useMemo } from 'react'
import { StatusBar } from 'expo-status-bar'
import { AppState, View, Text } from 'react-native'
import { Provider as UrqlProvider } from 'urql'
import { AuthProvider } from '@hylo/contexts/AuthContext'
import { useMakeUrqlClient } from '@hylo/urql/makeUrqlClient'
import mobileSubscriptionExchange from './urql/mobileSubscriptionExchange'
import { sentryConfig } from './config'
import * as Sentry from '@sentry/react-native'
import { OneSignal } from 'react-native-onesignal'
import Constants from 'expo-constants'
import { ActionSheetProvider } from '@expo/react-native-action-sheet'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { TRenderEngineProvider, defaultSystemFonts } from 'react-native-render-html'
import { baseStyle, tagsStyles, classesStyles } from './src/components/HyloHTML/HyloHTML.styles'
import RootNavigator from './src/navigation/RootNavigator'
import './src/style/global.css'

// Initialize Sentry
Sentry.init(sentryConfig)

// Enable screens for better performance
enableScreens()

export default function App() {
  const [urqlClient, setUrqlClient] = useState()
  const [appState, setAppState] = useState(AppState.currentState)
  const urqlClientFromHook = useMakeUrqlClient({ subscriptionExchange: null })

  // Memoize the TRenderEngineProvider props to prevent unnecessary re-renders
  const renderEngineProps = useMemo(() => ({
    baseStyle,
    tagsStyles,
    classesStyles,
    systemFonts: [...defaultSystemFonts, 'Circular-Book']
  }), [])

  useEffect(() => {
    if (urqlClientFromHook) {
      setUrqlClient(urqlClientFromHook)
    }
  }, [urqlClientFromHook])

  useEffect(() => {
    // Initialize OneSignal first, independently of urqlClient
    const oneSignalAppId = Constants.expoConfig?.extra?.oneSignalAppId
    if (oneSignalAppId) {
      try {
        OneSignal.initialize(oneSignalAppId)

        // Method for handling notifications received while app in foreground
        const foregroundWillDisplayHandler = event => {
          event.preventDefault()
          console.log('foreground notification received:', event.notification)
        }
        OneSignal.Notifications.addEventListener('foregroundWillDisplay', foregroundWillDisplayHandler)

        return () => {
          OneSignal.Notifications.removeEventListener('foregroundWillDisplay', foregroundWillDisplayHandler)
        }
      } catch (error) {
        console.warn('OneSignal initialization failed:', error)
      }
    }
  }, [])

  useEffect(() => {
    if (appState.match(/inactive|background/) && AppState.currentState === 'active') {
      try {
        OneSignal.Notifications.clearAll()
      } catch (error) {
        console.warn('OneSignal clearAll failed:', error)
      }
    }
  }, [appState])

  useEffect(() => {
    const appStateHandler = AppState.addEventListener('change', setAppState)
    return () => appStateHandler && appStateHandler.remove()
  }, [])

  // handleAppStateChange is now handled by useEffect hooks above

  if (!urqlClient) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 bg-background items-center justify-center">
          <Text className="text-foreground">Loading...</Text>
        </View>
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
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
              systemFonts={renderEngineProps.systemFonts}
            >
              <StatusBar style="auto" />
              <RootNavigator />
            </TRenderEngineProvider>
          </ActionSheetProvider>
        </AuthProvider>
      </UrqlProvider>
    </SafeAreaProvider>
  )
}
