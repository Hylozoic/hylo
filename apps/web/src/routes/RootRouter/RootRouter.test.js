import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import RootRouter, { isNeutralRootSessionLoadingPath } from './RootRouter'

jest.mock('routes/AuthLayoutRouter', () => () => 'AuthLayoutRouter')
jest.mock('routes/NonAuthLayoutRouter', () => () => 'NonAuthLayoutRouter')
jest.mock('components/Skeleton/BootstrapShell', () => () => 'BootstrapShell')
jest.mock('util/webView', () => ({
  __esModule: true,
  default: jest.fn(() => false),
  isWebView: jest.fn(() => false),
  isLegacyWebView: jest.fn(() => false),
  getMobileAppVersion: jest.fn(() => ''),
  sendMessageToWebView: jest.fn(),
  clearMobileWebViewUserLogout: jest.fn(),
  isMobileWebViewUserLogoutInProgress: jest.fn(() => false)
}))

function renderRootRouter () {
  return render(<RootRouter />, { wrapper: AllTheProviders({}, ['/login']) })
}

beforeEach(() => {
  window.HyloBootLoader = { ready: jest.fn(), milestone: jest.fn() }
  window.sessionStorage.clear()
})

afterEach(() => {
  delete window.HyloBootLoader
})

it('clears the stale-chunk reload flag and dismisses the boot loader once the session is known', async () => {
  window.sessionStorage.setItem('vite-reload-attempted', '1')
  mockGraphqlServer.use(
    graphql.query('CheckLogin', () => HttpResponse.json({ data: { me: null } }))
  )

  renderRootRouter()

  expect(await screen.findByText('NonAuthLayoutRouter')).toBeInTheDocument()
  expect(window.sessionStorage.getItem('vite-reload-attempted')).toBeNull()
  expect(window.HyloBootLoader.ready).toHaveBeenCalled()
})

it('shows a reconnecting notice on a server error and retries until the session is known', async () => {
  let calls = 0
  mockGraphqlServer.use(
    graphql.query('CheckLogin', () => {
      calls += 1
      if (calls === 1) return new HttpResponse('Service Unavailable', { status: 503 })
      return HttpResponse.json({ data: { me: null } })
    })
  )

  renderRootRouter()

  expect(await screen.findByText('Can\'t reach Hylo. Retrying…')).toBeInTheDocument()
  expect(screen.queryByText('NonAuthLayoutRouter')).not.toBeInTheDocument()
  expect(window.HyloBootLoader.ready).toHaveBeenCalled()

  expect(await screen.findByText('NonAuthLayoutRouter', {}, { timeout: 4000 })).toBeInTheDocument()
  expect(calls).toBe(2)
})

it('retries right away from the reconnecting notice', async () => {
  let calls = 0
  mockGraphqlServer.use(
    graphql.query('CheckLogin', () => {
      calls += 1
      if (calls === 1) return new HttpResponse('Bad Gateway', { status: 502 })
      return HttpResponse.json({ data: { me: null } })
    })
  )

  renderRootRouter()

  fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }))

  await waitFor(() => expect(calls).toBe(2), { timeout: 500 })
  expect(await screen.findByText('NonAuthLayoutRouter')).toBeInTheDocument()
})

it('treats a signed-out response as anonymous without retrying', async () => {
  let calls = 0
  mockGraphqlServer.use(
    graphql.query('CheckLogin', () => {
      calls += 1
      return HttpResponse.json({ data: { me: null } })
    })
  )

  renderRootRouter()

  expect(await screen.findByText('NonAuthLayoutRouter')).toBeInTheDocument()
  expect(screen.queryByTestId('root-reconnecting')).not.toBeInTheDocument()
  await new Promise(resolve => setTimeout(resolve, 1200))
  expect(calls).toBe(1)
})

describe('isNeutralRootSessionLoadingPath', () => {
  it('keeps invitation links on the neutral loading screen while the session loads', () => {
    expect(isNeutralRootSessionLoadingPath('/h/use-invitation')).toBe(true)
    expect(isNeutralRootSessionLoadingPath('/h/invitation')).toBe(true)
    expect(isNeutralRootSessionLoadingPath('/groups/garden/join/join-code')).toBe(true)
  })

  it('uses the app shell for main app paths', () => {
    expect(isNeutralRootSessionLoadingPath('/groups/garden')).toBe(false)
    expect(isNeutralRootSessionLoadingPath('/h')).toBe(false)
    expect(isNeutralRootSessionLoadingPath('/h/invitation/extra')).toBe(false)
  })
})
