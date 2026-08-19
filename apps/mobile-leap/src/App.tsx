import './style/global.css'
import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/react-native'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
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
import { hydrateStoredLocale } from './i18n'

if (sentryConfig.enabled) {
  const { enabled: _enabled, ...sentryInitOptions } = sentryConfig
  Sentry.init({
    ...sentryInitOptions,
    integrations: [Sentry.reactNativeTracingIntegration({ traceFetch: true })]
  })
}

const urqlStorage = makeAsyncStorage({
  dataKey: 'urql-app-cache',
  metadataKey: 'urql-app-metadata'
})

function AppProviders () {
  const urqlClient = useMakeUrqlClient({ storage: urqlStorage })
  const [localeReady, setLocaleReady] = useState(false)

  useEffect(() => {
    hydrateStoredLocale().finally(() => setLocaleReady(true))
  }, [])

  useEffect(() => {
    if (!urqlClient) return
    return setupOneSignal()
  }, [urqlClient])

  if (!urqlClient || !localeReady) {
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
