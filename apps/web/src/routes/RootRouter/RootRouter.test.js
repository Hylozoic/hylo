import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import RootRouter, { isNeutralRootSessionLoadingPath } from './RootRouter'

jest.mock('react-router-dom', () => jest.requireActual('react-router-dom'))
jest.mock('util/webView', () => ({
  __esModule: true,
  default: jest.fn(() => false),
  clearMobileWebViewUserLogout: jest.fn(),
  isMobileWebViewUserLogoutInProgress: jest.fn(() => false),
  sendMessageToWebView: jest.fn()
}))
jest.mock('routes/NonAuthLayoutRouter', () => {
  const { useLocation } = jest.requireActual('react-router-dom')
  return function MockNonAuthLayoutRouter () {
    const location = useLocation()
    return <div data-testid='non-auth-location'>{location.pathname + location.search}</div>
  }
})
jest.mock('routes/PostDetail', () => () => <div data-testid='public-post-detail' />)
jest.mock('routes/AuthLayoutRouter', () => () => <div />)
jest.mock('routes/PublicLayoutRouter', () => () => <div />)
jest.mock('routes/PublicLayoutRouter/PublicGroupDetail', () => () => <div />)
jest.mock('routes/PublicLayoutRouter/PublicPageHeader', () => () => <div />)
jest.mock('routes/OAuth/OAuthLayoutRouter', () => () => <div />)
jest.mock('routes/JoinGroup', () => () => <div />)
jest.mock('routes/OfferingDetails/OfferingDetails', () => () => <div />)

function mockSignedOutReader ({ publicPost }) {
  mockGraphqlServer.use(
    graphql.query('CheckLogin', () => HttpResponse.json({ data: { me: null } })),
    graphql.query('CheckIsPostPublic', () => HttpResponse.json({
      data: { post: publicPost ? { id: '91' } : null }
    }))
  )
}

describe('RootRouter signed out', () => {
  it('keeps the query string when a group post link sends the reader to log in', async () => {
    mockSignedOutReader({ publicPost: false })

    render(<RootRouter />, {
      wrapper: AllTheProviders({}, ['/groups/foo/all/post/91?action=unfollow&ctt=x'])
    })

    expect(await screen.findByTestId('non-auth-location')).toHaveTextContent(
      '/login?returnToUrl=%2Fpost%2F91%3Faction%3Dunfollow%26ctt%3Dx'
    )
  })

  it('sends the reader to log in from an unfollow link on a public post', async () => {
    mockSignedOutReader({ publicPost: true })

    render(<RootRouter />, {
      wrapper: AllTheProviders({}, ['/groups/foo/topics/bar/post/91?action=unfollow'])
    })

    expect(await screen.findByTestId('non-auth-location')).toHaveTextContent(
      '/login?returnToUrl=%2Fpost%2F91%3Faction%3Dunfollow'
    )
  })

  it('shows a public post without asking the reader to log in', async () => {
    mockSignedOutReader({ publicPost: true })

    render(<RootRouter />, {
      wrapper: AllTheProviders({}, ['/groups/foo/all/post/91?ctt=x'])
    })

    expect(await screen.findByTestId('public-post-detail')).toBeInTheDocument()
    expect(screen.queryByTestId('non-auth-location')).not.toBeInTheDocument()
  })
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
