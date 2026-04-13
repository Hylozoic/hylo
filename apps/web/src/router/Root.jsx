import React, { Suspense } from 'react'

const App = React.lazy(() => import('./index'))
const HyloEditorMobile = React.lazy(() => import('routes/HyloEditorMobile'))
const Feature = React.lazy(() => import('components/PostCard/Feature'))

function RootFallback () {
  return <div className='h-full min-h-screen w-full bg-midground' />
}

/**
 * Catches chunk load failures (stale asset URLs after a new deploy) and reloads
 * the page once. SessionStorage prevents an infinite reload loop.
 */
class ChunkErrorBoundary extends React.Component {
  componentDidCatch (error) {
    const isChunkError = (
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed')
    )
    if (isChunkError && !sessionStorage.getItem('vite-reload-attempted')) {
      sessionStorage.setItem('vite-reload-attempted', '1')
      window.location.reload()
    }
  }

  render () { return this.props.children }
}

export default function Root () {
  switch (window.location.pathname) {
    case '/hyloApp/editor': {
      return (
        <ChunkErrorBoundary>
          <Suspense fallback={null}>
            <HyloEditorMobile />
          </Suspense>
        </ChunkErrorBoundary>
      )
    }

    case '/hyloApp/videoPlayer': {
      const querystringParams = new URLSearchParams(window.location.search)

      return (
        <ChunkErrorBoundary>
          <Suspense fallback={null}>
            <Feature url={querystringParams.get('url')} />
          </Suspense>
        </ChunkErrorBoundary>
      )
    }

    default: {
      return (
        <ChunkErrorBoundary>
          <Suspense fallback={<RootFallback />}>
            <App />
          </Suspense>
        </ChunkErrorBoundary>
      )
    }
  }
}
