import React, { Suspense, useEffect } from 'react'
import ErrorBoundary from 'components/ErrorBoundary'
import { clearChunkReloadFlag } from 'client/chunkReload'

const App = React.lazy(() => import('./index'))
const HyloEditorMobile = React.lazy(() => import('routes/HyloEditorMobile'))
const Feature = React.lazy(() => import('components/PostCard/Feature'))

function RootFallback () {
  return <div className='h-full min-h-screen w-full bg-midground' />
}

/**
 * The embedded mobile screens never mount RootRouter, which is what normally
 * dismisses the boot loader, so they report ready once their chunk has rendered.
 */
function BootReady ({ children }) {
  useEffect(() => {
    window.HyloBootLoader?.ready?.()
    clearChunkReloadFlag()
  }, [])
  return children
}

export default function Root () {
  switch (window.location.pathname) {
    case '/hyloApp/editor': {
      return (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <BootReady>
              <HyloEditorMobile />
            </BootReady>
          </Suspense>
        </ErrorBoundary>
      )
    }

    case '/hyloApp/videoPlayer': {
      const querystringParams = new URLSearchParams(window.location.search)

      return (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <BootReady>
              <Feature url={querystringParams.get('url')} />
            </BootReady>
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
