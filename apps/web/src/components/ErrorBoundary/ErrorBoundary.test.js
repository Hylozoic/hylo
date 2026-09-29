import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import { chunkReloadPending, listenForStaleChunks, reloadPage } from 'client/chunkReload'
import ErrorBoundary from './ErrorBoundary'

// Mock the error reporter module
jest.mock('client/errorReporter', () => ({
  __esModule: true,
  default: {
    error: jest.fn()
  }
}))

jest.mock('client/chunkReload', () => ({
  ...jest.requireActual('client/chunkReload'),
  reloadPage: jest.fn()
}))

const ErrorThrowingComponent = () => {
  throw new Error('Test error')
}

const ChunkErrorComponent = () => {
  throw new TypeError('Failed to fetch dynamically imported module: /assets/index-abc.js')
}

// A lazy route whose chunk is gone, failing as Vite's preload helper does in a
// build: it dispatches vite:preloadError, then rethrows the import's error
const renderStaleLazyRoute = () => {
  const StaleRoute = React.lazy(() => {
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))
    return Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/Route-abc.js'))
  })
  render(
    <ErrorBoundary>
      <React.Suspense fallback={<div data-testid='route-loading' />}>
        <StaleRoute />
      </React.Suspense>
    </ErrorBoundary>
  )
  return waitFor(() => expect(screen.queryByTestId('route-loading')).not.toBeInTheDocument())
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    window.HyloBootLoader = { ready: jest.fn(), milestone: jest.fn() }
    window.sessionStorage.clear()
    reloadPage.mockClear()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    delete window.HyloBootLoader
  })

  it('renders children correctly', () => {
    render(
      <ErrorBoundary message='An Error Message'>
        <div data-testid='child'>Child Component</div>
      </ErrorBoundary>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders an error message when an error is thrown', () => {
    render(
      <ErrorBoundary message='An Error Message'>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('An Error Message')).toBeInTheDocument()
    expect(screen.getByTestId('error-boundary-container')).toBeInTheDocument()
  })

  it('dismisses the boot loader so a render crash does not leave an endless loading screen', () => {
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    )

    expect(window.HyloBootLoader.ready).toHaveBeenCalled()
  })

  it('offers a Reload button that reloads the page', () => {
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reloadPage).toHaveBeenCalledTimes(1)
  })

  it('links to Building Hylo for help', () => {
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    )

    expect(screen.getByRole('link', { name: 'Need help?' })).toHaveAttribute('href', '/groups/building-hylo/about')
  })

  it('reloads once for a stale chunk instead of showing the error', () => {
    render(
      <ErrorBoundary>
        <ChunkErrorComponent />
      </ErrorBoundary>
    )

    expect(chunkReloadPending()).toBe(true)
    expect(screen.queryByTestId('error-boundary-container')).not.toBeInTheDocument()
    expect(window.HyloBootLoader.ready).not.toHaveBeenCalled()
  })

  it('shows the error with Reload when a stale chunk fails again after the reload', () => {
    window.sessionStorage.setItem('vite-reload-attempted', '1')

    render(
      <ErrorBoundary>
        <ChunkErrorComponent />
      </ErrorBoundary>
    )

    expect(reloadPage).not.toHaveBeenCalled()
    expect(screen.getByTestId('error-boundary-container')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(window.HyloBootLoader.ready).toHaveBeenCalled()
  })

  describe('with the vite:preloadError listener from index.jsx', () => {
    let stopListening

    beforeEach(() => {
      stopListening = listenForStaleChunks()
    })

    afterEach(() => {
      stopListening()
    })

    it('waits for the reload the listener started instead of flashing the error', async () => {
      await renderStaleLazyRoute()

      expect(chunkReloadPending()).toBe(true)
      expect(screen.queryByTestId('error-boundary-container')).not.toBeInTheDocument()
      expect(window.HyloBootLoader.ready).not.toHaveBeenCalled()
    })

    it('shows the error with Reload when the chunk is still missing after the reload', async () => {
      window.sessionStorage.setItem('vite-reload-attempted', '1')

      await renderStaleLazyRoute()

      expect(chunkReloadPending()).toBe(false)
      expect(screen.getByTestId('error-boundary-container')).toBeInTheDocument()
      expect(window.HyloBootLoader.ready).toHaveBeenCalled()
    })
  })
})
