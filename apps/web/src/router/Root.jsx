import React, { Suspense } from 'react'
import ErrorBoundary from 'components/ErrorBoundary'

const App = React.lazy(() => import('./index'))
const HyloEditorMobile = React.lazy(() => import('routes/HyloEditorMobile'))
const Feature = React.lazy(() => import('components/PostCard/Feature'))

function RootFallback () {
  return <div className='h-full min-h-screen w-full bg-midground' />
}

export default function Root () {
  switch (window.location.pathname) {
    case '/hyloApp/editor': {
      return (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <HyloEditorMobile />
          </Suspense>
        </ErrorBoundary>
      )
    }

    case '/hyloApp/videoPlayer': {
      const querystringParams = new URLSearchParams(window.location.search)

      return (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <Feature url={querystringParams.get('url')} />
          </Suspense>
        </ErrorBoundary>
      )
    }

    default: {
      return (
        <ErrorBoundary>
          <Suspense fallback={<RootFallback />}>
            <App />
          </Suspense>
        </ErrorBoundary>
      )
    }
  }
}
