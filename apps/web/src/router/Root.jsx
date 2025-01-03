import React, { Suspense } from 'react'
import Loading from 'components/Loading'

const App = React.lazy(() => import('./index'))
const HyloEditorMobile = React.lazy(() => import('routes/HyloEditorMobile'))
const Feature = React.lazy(() => import('components/PostCard/Feature'))

export default function Root () {
  switch (window.location.pathname) {
    case '/hyloApp/editor': {
      return (
        <Suspense fallback={null}>
          <HyloEditorMobile />
        </Suspense>
      )
    }

    case '/hyloApp/videoPlayer': {
      const querystringParams = new URLSearchParams(window.location.search)

      return (
        <Suspense fallback={null}>
          <Feature url={querystringParams.get('url')} />
        </Suspense>
      )
    }

    default: {
      return (
        <Suspense fallback={<Loading type='fullscreen' />}>
          <App />
        </Suspense>
      )
    }
  }
}
