import React from 'react'
import { Provider as ReduxProvider } from 'react-redux'
import { Provider as UrqlProvider, createClient } from 'urql'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
// DEPRECATED: react-native-render-html no longer needed
// import { TRenderEngineProvider } from 'react-native-render-html'
import { getEmptyState } from 'store'
// DEPRECATED: HyloHTMLConfigProvider is now a no-op
// import { HyloHTMLConfigProvider } from 'components/HyloHTML'

// ✅ Create a mocked URQL client (prevents missing query/mutation errors)
const mockUrqlClient = createClient({
  url: 'http://localhost/graphql', // Mock API
  exchanges: [], // No need for actual exchanges
  suspense: false
})

export function createMockStore (state = {}) {
  return {
    subscribe: jest.fn(),
    getState: jest.fn(() => state),
    dispatch: jest.fn()
  }
}

const emptyState = getEmptyState()

export function TestRoot ({
  store: providedStore,
  state: providedState,
  children
}) {
  const store = providedStore || createMockStore(providedState || emptyState)

  return (
    <SafeAreaProvider>
      <ReduxProvider store={store}>
        <UrqlProvider value={mockUrqlClient}>
          <NavigationContainer>
            {children}
          </NavigationContainer>
        </UrqlProvider>
      </ReduxProvider>
    </SafeAreaProvider>
  )
}
