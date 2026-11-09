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
import useThemeStore from './store/themeStore'
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
  const backgroundColor = useThemeStore(state => state.backgroundColor)
  const hydrateTheme = useThemeStore(state => state.hydrate)
  const [localeReady, setLocaleReady] = useState(false)
  const [themeReady, setThemeReady] = useState(false)

  useEffect(() => {
    hydrateStoredLocale().finally(() => setLocaleReady(true))
    hydrateTheme().then(() => setThemeReady(true))
  }, [hydrateTheme])

  useEffect(() => {
    if (!urqlClient) return
    return setupOneSignal()
  }, [urqlClient])

  if (!urqlClient || !localeReady || !themeReady) {
    return (
      <View className='flex-1 items-center justify-center' style={{ backgroundColor }}>
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
  const backgroundColor = useThemeStore(state => state.backgroundColor)

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AppProviders />
        </ErrorBoundary>
        <StatusBar style='auto' />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
