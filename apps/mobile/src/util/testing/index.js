import React from 'react'
import { Provider } from 'react-redux'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { TRenderEngineProvider } from 'react-native-render-html'
import { getEmptyState } from 'store'
import { HyloHTMLConfigProvider } from 'components/HyloHTML/HyloHTML'

export function createMockStore (state = {}) {
  return {
    subscribe: jest.fn(),
    getState: jest.fn(() => state),
    dispatch: jest.fn()
  }
}

const emptyState = getEmptyState()

// Basic utility CurrentUserState -- to be further abstracted
export function createInitialStateWithCurrentUser () {
  const session = orm.session(orm.getEmptyState())
  const { Me } = session

  Me.create({
    id: 'current-user-id',
    name: 'Current User'
  })

  return getEmptyState({
    orm: session.state
  })
}

export function TestRoot ({
  store: providedStore,
  state: providedState,
  children
}) {
  const store = providedStore || createMockStore(providedState || emptyState)

  return (
    <SafeAreaProvider>
      <TRenderEngineProvider>
        <Provider store={store}>
          <HyloHTMLConfigProvider>
            <NavigationContainer>
              {children}
            </NavigationContainer>
          </HyloHTMLConfigProvider>
        </Provider>
      </TRenderEngineProvider>
    </SafeAreaProvider>
  )
}

// Mock graphql "server"

// This should be ran once per test suite, i.e.
//   `beforeAll(() => createMockGraphqlServer(handlers))`
// To learn how to make query or mutation handlers see:
//   https://mswjs.io/docs/getting-started/mocks/graphql-api
// (Will need `import { graphql } from 'msw'` in test file)
// Also `afterEach(() => { server.resetHandlers() })`is required
// export const createMockGraphqlServer = handlers => setupServer(...handlers).listen()

// Misc and legacy test utils

// Temporary brain-dead test event simulation, until either Enzyme or
// react-dom/test-utils decides to make React Native a first-class citizen
//
// Use:
//
//   const root = TestRenderer.create(<FooBar />).root
//   simulate(root.findByType(TouchableOpacity), 'press')
//   expect(someFunction).toHaveBeenCalled()
//
// where `someFunction` is a `jest.fn()`. The event object can be passed as the
// third argument, otherwise it will receive a default value.
export function simulate (instance, eventName, evt = {}) {
  const titleCase = `${eventName[0].toUpperCase()}${eventName.substring(1)}`
  const handlerName = `on${titleCase}`
  const handler = instance.props[handlerName]
  // TODO: in theory we could pass a `ResponderSyntheticEvent` by default, because that's
  // what TouchableOpacity emits. It's probably not necessary for most tests though. It'd
  // also introduce a dependency on react-dom.
  if (handler) handler(evt)
}
