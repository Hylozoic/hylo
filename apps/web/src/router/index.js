import React from 'react'
import { HistoryRouter as Router } from 'redux-first-history/rr6'
import { Provider } from 'react-redux'
import AppearanceSync from 'components/AppearanceSync'
import { TooltipProvider } from 'components/ui/tooltip'
// import { Provider as RollbarProvider, ErrorBoundary } from '@rollbar/react'
import { LayoutFlagsProvider } from 'contexts/LayoutFlagsContext'
import { ViewHeaderProvider } from 'contexts/ViewHeaderContext/ViewHeaderProvider'
import { DropdownProvider } from 'contexts/DropdownContext'
import { CookieConsentProvider } from 'contexts/CookieConsentContext'
import CookiePreferencesPanel from 'components/CookiePreferencesPanel'
import store, { history, sandboxBasename } from '../store'
import RootRouter from 'routes/RootRouter'
import { Helmet } from 'react-helmet'

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
        <AppearanceSync />
        <TooltipProvider delayDuration={0}>
          <CookieConsentProvider>
            <ViewHeaderProvider>
              <DropdownProvider>
                <Router history={history} basename={sandboxBasename}>
                  {sandboxBasename && (
                    <Helmet>
                      <meta name='robots' content='noindex, nofollow' />
                    </Helmet>
                  )}
                  <RootRouter />
                  <CookiePreferencesPanel />
                </Router>
              </DropdownProvider>
            </ViewHeaderProvider>
          </CookieConsentProvider>
        </TooltipProvider>
      </Provider>
    </LayoutFlagsProvider>
  )
}
