import { createBrowserHistory } from 'history'
import React from 'react'
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { createReduxHistoryContext } from 'redux-first-history'
import { render } from '@testing-library/react'
import { getEmptyState } from 'store'
import createRootReducer from 'store/reducers'
import createMiddleware from 'store/middleware'
import { LayoutFlagsProvider } from 'contexts/LayoutFlagsContext'
import { TooltipProvider } from 'components/ui/tooltip'

// Note: This is ran by default via `customRender` below, but it's necessary to manually
// generate the store when pre-populating the ReduxORM in a test. Search across tests to
// for examples. Merges `provideState` over default app empty state
export function generateStore (providedState) {
  const {
    routerMiddleware,
    routerReducer
  } = createReduxHistoryContext({ history: createBrowserHistory() })

  return createStore(
    createRootReducer(routerReducer),
    { ...getEmptyState(), ...providedState },
    createMiddleware(routerMiddleware)
  )
}

// This is used by default with an empty state in `customRender` (exported as render)
// import and use this directly, providing state, when needing custom state, e.g.:
//
//   `render(<ComponentUnderTest />, { wrapper: AllTheProviders(myOwnReduxState) }) />)`
//
export const AllTheProviders = (providedState, initialEntries = []) => ({ children }) => {
  return (
    <LayoutFlagsProvider>
      <Provider store={generateStore(providedState)}>
        <TooltipProvider>
          {initialEntries.length > 0
            ? (
              <MemoryRouter initialEntries={initialEntries}>
                <Routes>
                  <Route path='*' element={children} />
                </Routes>
              </MemoryRouter>
              )
            : (
              <BrowserRouter>
                <Routes>
                  <Route path='*' element={children} />
                </Routes>
              </BrowserRouter>
              )}
        </TooltipProvider>
      </Provider>
    </LayoutFlagsProvider>
  )
}

// Creates the `<div id='root'>`
export function createRootContainer () {
  const rootElement = document.createElement('div')
  rootElement.setAttribute('id', 'root')
  return document.body.appendChild(rootElement)
}

// If an initialized but empty store is adequate then no providerFunc needs to be supplied
const customRender = (ui, options = {}, providersFunc) => {
  return render(ui, {
    wrapper: providersFunc || AllTheProviders(),
    container: createRootContainer(),
    ...options
  })
}

// re-export everything

/* eslint-disable import/export */
export * from '@testing-library/react'

// override render method
export { customRender as render }
