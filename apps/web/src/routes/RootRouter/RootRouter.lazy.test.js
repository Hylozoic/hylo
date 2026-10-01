import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import RootRouter from './RootRouter'

// The signed-out app's code can't be fetched (e.g. a chunk removed by a deploy)
jest.mock('routes/NonAuthLayoutRouter', () => {
  throw new Error('Failed to fetch dynamically imported module')
})
jest.mock('components/Skeleton/BootstrapShell', () => () => 'BootstrapShell')
jest.mock('util/webView', () => ({
  __esModule: true,
  default: jest.fn(() => false),
  isWebView: jest.fn(() => false),
  clearMobileWebViewUserLogout: jest.fn(),
  isMobileWebViewUserLogoutInProgress: jest.fn(() => false),
  sendMessageToWebView: jest.fn()
}))

class CatchError extends React.Component {
  constructor (props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError (error) {
    return { error }
  }

  render () {
    return this.state.error ? <div>Route failed to load</div> : this.props.children
  }
}

beforeEach(() => {
  window.HyloBootLoader = { ready: jest.fn(), milestone: jest.fn() }
  window.sessionStorage.clear()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  delete window.HyloBootLoader
  console.error.mockRestore()
})

it('keeps the stale-chunk reload flag and the boot loader until the route code has loaded', async () => {
  window.sessionStorage.setItem('vite-reload-attempted', '1')
  mockGraphqlServer.use(
    graphql.query('CheckLogin', () => HttpResponse.json({ data: { me: null } }))
  )

  render(<CatchError><RootRouter /></CatchError>, { wrapper: AllTheProviders({}, ['/login']) })

  expect(await screen.findByText('Route failed to load', {}, { timeout: 10000 })).toBeInTheDocument()
  expect(window.sessionStorage.getItem('vite-reload-attempted')).toBe('1')
  expect(window.HyloBootLoader.ready).not.toHaveBeenCalled()
})
