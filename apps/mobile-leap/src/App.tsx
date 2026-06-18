import './style/global.css'
import { useEffect } from 'react'
import * as Sentry from '@sentry/react-native'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Provider as UrqlProvider } from 'urql'
import { makeAsyncStorage } from '@urql/storage-rn'
import { AuthProvider } from '@hylo/contexts/AuthContext'
import { useMakeUrqlClient } from '@hylo/urql/makeUrqlClient'
import { mobileAuthAdapter } from 'util/authAdapter'
import { sentryConfig } from './config/sentry'
import ErrorBoundary from './components/ErrorBoundary'
import VersionCheck from './components/VersionCheck'
import { setupOneSignal } from './services/onesignal'
import RootNavigator from './navigation/RootNavigator'

if (sentryConfig.enabled) {
  Sentry.init({
    ...sentryConfig,
    integrations: [
      Sentry.reactNativeTracingIntegration({ traceFetch: true }),
      Sentry.breadcrumbsIntegration({ fetch: true })
    ]
  })
}

const urqlStorage = makeAsyncStorage({
  dataKey: 'urql-app-cache',
  metadataKey: 'urql-app-metadata',
  storage: AsyncStorage
})

function AppProviders () {
  const urqlClient = useMakeUrqlClient({ storage: urqlStorage })

  useEffect(() => {
    if (!urqlClient) return
    return setupOneSignal()
  }, [urqlClient])

  if (!urqlClient) {
    return (
      <View className='flex-1 items-center justify-center bg-background'>
        <ActivityIndicator />
        <Text className='mt-2 text-muted-foreground'>Starting…</Text>
      </View>
    )
  }

  return (
    <UrqlProvider value={urqlClient}>
      <AuthProvider authAdapter={mobileAuthAdapter}>
        <VersionCheck />
        <RootNavigator />
      </AuthProvider>
    </UrqlProvider>
  )
}

export default function App () {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AppProviders />
        </ErrorBoundary>
        <StatusBar style='auto' />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
