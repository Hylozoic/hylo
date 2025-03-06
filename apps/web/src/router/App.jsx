import mixpanel from 'mixpanel-browser'
import React from 'react'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from 'components/ThemeProvider'
import { TooltipProvider } from 'components/ui/tooltip'
import config, { isProduction, isTest } from 'config/index'
import { LayoutFlagsProvider } from 'contexts/LayoutFlagsContext'
import { ViewHeaderProvider } from 'contexts/ViewHeaderContext/ViewHeaderProvider'
import router from './index'
import store from '../store'

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

if (!isTest) {
  mixpanel.init(config.mixpanel.token, { debug: !isProduction })
}

export default function App () {
  return (
    <LayoutFlagsProvider>
      <Provider store={store}>
        <ThemeProvider>
          <TooltipProvider delayDuration={0}>
            <ViewHeaderProvider>
              <RouterProvider router={router} />
            </ViewHeaderProvider>
          </TooltipProvider>
        </ThemeProvider>
      </Provider>
    </LayoutFlagsProvider>
  )
}
