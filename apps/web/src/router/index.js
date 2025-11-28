import React from 'react'
import { HistoryRouter as Router } from 'redux-first-history/rr6'
import { Provider } from 'react-redux'
import { ThemeProvider } from 'components/ThemeProvider'
import { TooltipProvider } from 'components/ui/tooltip'
// import { Provider as RollbarProvider, ErrorBoundary } from '@rollbar/react'
import { LayoutFlagsProvider } from 'contexts/LayoutFlagsContext'
import { ViewHeaderProvider } from 'contexts/ViewHeaderContext/ViewHeaderProvider'
import { DropdownProvider } from 'contexts/DropdownContext'
import { CookieConsentProvider } from 'contexts/CookieConsentContext'
import CookiePreferencesPanel from 'components/CookiePreferencesPanel'
import store, { history } from '../store'
import RootRouter from 'routes/RootRouter'
import isWebView from 'util/webView'

// DEPRECATED: History listener no longer needed - web app handles all navigation
// if (isWebView()) {
//   window.addHyloWebViewListener(history)
// }

// same configuration you would create for the Rollbar.js SDK
// const rollbarConfig = {
//   accessToken: process.env.ROLLBAR_CLIENT_TOKEN,
//   captureUncaught: true,
//   captureUnhandledRejections: true,
//   environment: process.env.NODE_ENV,
//   server: {
//     root: "http://example.com/",
//     branch: "main"
//   },
//   code_version: "0.13.7",
//   payload: {
//     person: {
//       id: 117,
//       email: "chief@unsc.gov",
//       username: "john-halo"
//     }
//   }
// };

export default function App () {
  return (
    <LayoutFlagsProvider>
      <Provider store={store}>
        <ThemeProvider>
          <TooltipProvider delayDuration={0}>
            <CookieConsentProvider>
              <ViewHeaderProvider>
                <DropdownProvider>
                  <Router history={history}>
                    <RootRouter />
                    <CookiePreferencesPanel />
                  </Router>
                </DropdownProvider>
              </ViewHeaderProvider>
            </CookieConsentProvider>
          </TooltipProvider>
        </ThemeProvider>
      </Provider>
    </LayoutFlagsProvider>
  )
}
