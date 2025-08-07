import 'react-native-gesture-handler'
import { enableScreens } from 'react-native-screens'
import React, { useEffect, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Text, View, ScrollView, TouchableOpacity, AppState } from 'react-native'
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
import './src/style/global.css'

// Initialize Sentry
Sentry.init(sentryConfig)

// Enable screens for better performance
enableScreens()

export default function App() {
  const [urqlClient, setUrqlClient] = useState()
  const [appState, setAppState] = useState(AppState.currentState)
  const urqlClientFromHook = useMakeUrqlClient({ subscriptionExchange: mobileSubscriptionExchange })

  useEffect(() => {
    if (urqlClientFromHook) {
      setUrqlClient(urqlClientFromHook)
    }
  }, [urqlClientFromHook])

  useEffect(() => {
    if (urqlClient) {
      // Initialize OneSignal
      const oneSignalAppId = Constants.expoConfig?.extra?.oneSignalAppId
      if (oneSignalAppId) {
        OneSignal.initialize(oneSignalAppId)

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
    }
  }, [urqlClient])

  const handleAppStateChange = nextAppState => {
    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      OneSignal.Notifications.clearAll()
    }
    setAppState(nextAppState)
  }

  if (!urqlClient) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-foreground">Loading...</Text>
      </View>
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
              systemFonts={[...defaultSystemFonts, 'Circular-Book']}
            >
              <View className="flex-1 bg-background">
                <StatusBar style="auto" />
                
                {/* Header */}
                <View className="bg-primary p-6 pt-12">
                  <Text className="text-primary-foreground text-2xl font-bold text-center">
                    Hylo Expo Test
                  </Text>
                  <Text className="text-primary-foreground/80 text-center mt-2">
                    Core Providers + OneSignal + ActionSheet + SafeArea + HTML Rendering Integration Test
                  </Text>
                </View>

                <ScrollView className="flex-1 p-6">
                  {/* Basic styling test */}
                  <View className="bg-card rounded-lg p-4 mb-4 shadow-sm">
                    <Text className="text-card-foreground text-lg font-semibold mb-2">
                      Core Providers Status
                    </Text>
                    <Text className="text-muted-foreground">
                      ✅ URQL Client: Connected
                    </Text>
                    <Text className="text-muted-foreground">
                      ✅ Auth Provider: Active
                    </Text>
                    <Text className="text-muted-foreground">
                      ✅ Sentry: Initialized
                    </Text>
                    <Text className="text-muted-foreground">
                      ✅ OneSignal: {Constants.expoConfig?.extra?.oneSignalAppId ? 'Configured' : 'Not Configured'}
                    </Text>
                    <Text className="text-muted-foreground">
                      ✅ ActionSheet: Available
                    </Text>
                    <Text className="text-muted-foreground">
                      ✅ SafeArea: Available
                    </Text>
                    <Text className="text-muted-foreground">
                      ✅ HTML Rendering: Available
                    </Text>
                  </View>

                  {/* Color palette test */}
                  <View className="mb-6">
                    <Text className="text-foreground text-lg font-semibold mb-3">
                      Color Palette Test
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      <View className="bg-primary w-16 h-16 rounded-lg items-center justify-center">
                        <Text className="text-primary-foreground text-xs">Primary</Text>
                      </View>
                      <View className="bg-secondary w-16 h-16 rounded-lg items-center justify-center">
                        <Text className="text-secondary-foreground text-xs">Secondary</Text>
                      </View>
                      <View className="bg-accent w-16 h-16 rounded-lg items-center justify-center">
                        <Text className="text-accent-foreground text-xs">Accent</Text>
                      </View>
                      <View className="bg-destructive w-16 h-16 rounded-lg items-center justify-center">
                        <Text className="text-destructive-foreground text-xs">Destructive</Text>
                      </View>
                      <View className="bg-muted w-16 h-16 rounded-lg items-center justify-center">
                        <Text className="text-muted-foreground text-xs">Muted</Text>
                      </View>
                    </View>
                  </View>

                  {/* Interactive elements test */}
                  <View className="mb-6">
                    <Text className="text-foreground text-lg font-semibold mb-3">
                      Interactive Elements
                    </Text>
                    <TouchableOpacity className="bg-primary rounded-lg p-4 mb-3 active:opacity-80">
                      <Text className="text-primary-foreground text-center font-semibold">
                        Primary Button
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity className="bg-secondary rounded-lg p-4 mb-3 active:opacity-80">
                      <Text className="text-secondary-foreground text-center font-semibold">
                        Secondary Button
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity className="border border-border rounded-lg p-4 active:opacity-80">
                      <Text className="text-foreground text-center font-semibold">
                        Outline Button
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Chart colors test */}
                  <View className="mb-6">
                    <Text className="text-foreground text-lg font-semibold mb-3">
                      Chart Colors
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      <View className="bg-chart-1 w-12 h-12 rounded-lg items-center justify-center">
                        <Text className="text-white text-xs">1</Text>
                      </View>
                      <View className="bg-chart-2 w-12 h-12 rounded-lg items-center justify-center">
                        <Text className="text-white text-xs">2</Text>
                      </View>
                      <View className="bg-chart-3 w-12 h-12 rounded-lg items-center justify-center">
                        <Text className="text-white text-xs">3</Text>
                      </View>
                      <View className="bg-chart-4 w-12 h-12 rounded-lg items-center justify-center">
                        <Text className="text-white text-xs">4</Text>
                      </View>
                      <View className="bg-chart-5 w-12 h-12 rounded-lg items-center justify-center">
                        <Text className="text-white text-xs">5</Text>
                      </View>
                    </View>
                  </View>

                  {/* Theme colors test */}
                  <View className="mb-6">
                    <Text className="text-foreground text-lg font-semibold mb-3">
                      Theme Colors
                    </Text>
                    <View className="space-y-2">
                      <View className="bg-theme-background border border-border rounded-lg p-3">
                        <Text className="text-theme-foreground text-sm">Theme Background</Text>
                      </View>
                      <View className="bg-midground border border-border rounded-lg p-3">
                        <Text className="text-foreground text-sm">Midground</Text>
                      </View>
                      <View className="bg-selected border border-border rounded-lg p-3">
                        <Text className="text-foreground text-sm">Selected</Text>
                      </View>
                    </View>
                  </View>

                  {/* Error colors test */}
                  <View className="mb-6">
                    <Text className="text-foreground text-lg font-semibold mb-3">
                      Error Colors
                    </Text>
                    <View className="bg-error rounded-lg p-4">
                      <Text className="text-error-foreground text-sm font-semibold">
                        Error Message Example
                      </Text>
                      <Text className="text-error-foreground/80 text-xs mt-1">
                        This shows how error states would look
                      </Text>
                    </View>
                  </View>

                  {/* Popover test */}
                  <View className="mb-6">
                    <Text className="text-foreground text-lg font-semibold mb-3">
                      Popover Colors
                    </Text>
                    <View className="bg-popover border border-border rounded-lg p-4">
                      <Text className="text-popover-foreground text-sm font-semibold">
                        Popover Content
                      </Text>
                      <Text className="text-popover-foreground/80 text-xs mt-1">
                        This shows popover styling
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              </View>
            </TRenderEngineProvider>
          </ActionSheetProvider>
        </AuthProvider>
      </UrqlProvider>
    </SafeAreaProvider>
  )
}
