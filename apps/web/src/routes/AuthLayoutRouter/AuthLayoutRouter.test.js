import React from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { graphql, HttpResponse } from 'msw'
import mixpanel from 'mixpanel-browser'
import orm from 'store/models'
import { getCookieConsent } from 'util/cookieConsent'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen, waitForElementToBeRemoved, waitFor } from 'util/testing/reactTestingLibraryExtended'
import AuthLayoutRouter from './AuthLayoutRouter'

// A Mixpanel token, so the consent checks (not a missing token) decide what is sent
jest.mock('config/index', () => {
  const actual = jest.requireActual('config/index')
  return { __esModule: true, ...actual, default: { ...actual.default, mixpanel: { token: 'test-token' } } }
})

const mockIntercomProviderProps = []
jest.mock('react-use-intercom', () => ({
  IntercomProvider: props => {
    mockIntercomProviderProps.push(props)
    return props.children
  },
  useIntercom: () => ({ show: () => {}, boot: () => {}, shutdown: () => {} })
}))

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockReturnValue({ context: 'groups', groupSlug: 'test-group' }),
  useLocation: jest.fn().mockReturnValue({ pathname: '/groups/test-group', search: '' })
}))

jest.mock('routes/JoinGroup', () => () => <div>JoinGroup route</div>)

const useParamsMocked = jest.mocked(useParams)
const useLocationMocked = jest.mocked(useLocation)

const defaultGraphqlHandlers = () => [
  graphql.query('MessageThreadsQuery', () => HttpResponse.json({ data: { me: null } })),
  graphql.query('MyPendingJoinRequestsQuery', () => HttpResponse.json({ data: { joinRequests: null } })),
  graphql.query('NotificationsQuery', () => HttpResponse.json({ data: { notifications: null } })),
  graphql.query('FetchPlatformAgreements', () => HttpResponse.json({ data: { platformAgreements: null } })),
  graphql.query('GroupWelcomeQuery', () => HttpResponse.json({ data: { group: null } })),
  graphql.query('PostsQuery', () => HttpResponse.json({ data: { group: null } })),
  graphql.query('GroupPostsQuery', () => HttpResponse.json({ data: { group: null } })),
  graphql.query('FetchGroupViews', () => HttpResponse.json({ data: { group: null } })),
  graphql.query('FetchGroupSpaces', () => HttpResponse.json({ data: { group: null } })),
  graphql.operation(() => HttpResponse.json({ data: {} }))
]

const testWrapper = (providedState, initialEntries = [], seed) => ({ children }) => {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  if (seed) seed(ormSession)
  const reduxState = { orm: ormSession.state, ...providedState }

  const AllTheProvidersComponent = AllTheProviders(reduxState, initialEntries)
  return <AllTheProvidersComponent>{children}</AllTheProvidersComponent>
}

it('shows group if the group exists', async () => {
  const group = {
    id: '1',
    slug: 'test-group',
    name: 'Test Group'
  }
  const membership = {
    id: '1',
    person: { id: '1' },
    group,
    settings: {
      showJoinForm: false,
      joinQuestionsAnsweredAt: '2020-01-01T00:00:00.000Z'
    }
  }
  const me = {
    id: '1',
    name: 'Test User',
    hasRegistered: true,
    emailValidated: true,
    settings: {
      signupInProgress: false,
      alreadySeenTour: true
    },
    memberships: [membership]
  }

  useParamsMocked.mockReturnValue({ context: 'groups', groupSlug: 'test-group' })
  useLocationMocked.mockReturnValue({ pathname: '/groups/test-group', search: '' })

  mockGraphqlServer.use(
    graphql.query('MeQuery', () => HttpResponse.json({ data: { me } })),
    graphql.query('FetchForGroup', () => HttpResponse.json({ data: { group } })),
    graphql.query('GroupDetailsQuery', () => HttpResponse.json({ data: { group } })),
    ...defaultGraphqlHandlers()
  )

  render(
    <AuthLayoutRouter />,
    { wrapper: testWrapper({}, ['/groups/test-group']) }
  )

  await waitForElementToBeRemoved(screen.queryByTestId('loading-screen'))

  await waitFor(() => {
    expect(screen.getByText('Test Group')).toBeInTheDocument()
  })
})

it('shows NotFound if the group does not exist', async () => {
  const me = {
    id: '1',
    name: 'Test User',
    hasRegistered: true,
    emailValidated: true,
    settings: {
      signupInProgress: false,
      alreadySeenTour: true
    },
    memberships: [{ id: '3', person: { id: '3' } }]
  }

  useParamsMocked.mockReturnValue({ context: 'groups', groupSlug: 'no-group' })
  useLocationMocked.mockReturnValue({ pathname: '/groups/no-group', search: '' })

  mockGraphqlServer.use(
    graphql.query('MeQuery', () => HttpResponse.json({ data: { me } })),
    graphql.query('FetchForGroup', () => HttpResponse.json({ data: { group: null } })),
    graphql.query('GroupDetailsQuery', () => HttpResponse.json({ data: { group: null } })),
    ...defaultGraphqlHandlers()
  )

  render(
    <AuthLayoutRouter />,
    { wrapper: testWrapper({}, ['/groups/no-group']) }
  )

  await waitForElementToBeRemoved(screen.queryByTestId('loading-screen'))

  await waitFor(() => {
    expect(screen.getByText('Oops, there\'s nothing to see here.')).toBeInTheDocument()
  })
})

it.each([
  ['/h/use-invitation', '?token=steward-token'],
  ['/h/invitation', '?token=member-token']
])('opens the invitation link %s with JoinGroup', async (pathname, search) => {
  const me = {
    id: '1',
    name: 'Test User',
    hasRegistered: true,
    emailValidated: true,
    settings: {
      signupInProgress: false,
      alreadySeenTour: true
    },
    memberships: []
  }

  useParamsMocked.mockReturnValue({})
  useLocationMocked.mockReturnValue({ pathname, search })

  mockGraphqlServer.use(
    graphql.query('MeQuery', () => HttpResponse.json({ data: { me } })),
    ...defaultGraphqlHandlers()
  )

  render(
    <AuthLayoutRouter />,
    { wrapper: testWrapper({}, [pathname + search]) }
  )

  expect(await screen.findByText('JoinGroup route')).toBeInTheDocument()
})

describe('cookie consent', () => {
  const group = { id: '1', slug: 'test-group', name: 'Test Group' }
  const me = {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    hasRegistered: true,
    emailValidated: true,
    settings: { signupInProgress: false, alreadySeenTour: true },
    memberships: [{
      id: '1',
      person: { id: '1' },
      group,
      settings: { showJoinForm: false, joinQuestionsAnsweredAt: '2020-01-01T00:00:00.000Z' }
    }],
    // What MeQuery returns when the account has no saved choice
    cookieConsentPreferences: null
  }

  // Me as CheckLogin leaves it, before MeQuery has loaded the account's choice
  const seedCheckLoginMe = session => {
    const { id, name, email, hasRegistered, emailValidated, settings } = me
    session.Me.create({ id, name, email, hasRegistered, emailValidated, settings })
  }

  const renderGroupPage = async ({ meQueryResult = me, seed } = {}) => {
    useParamsMocked.mockReturnValue({ context: 'groups', groupSlug: 'test-group' })
    useLocationMocked.mockReturnValue({ pathname: '/groups/test-group', search: '' })
    mockGraphqlServer.use(
      graphql.query('MeQuery', () => HttpResponse.json({ data: { me: meQueryResult } })),
      graphql.query('FetchForGroup', () => HttpResponse.json({ data: { group } })),
      graphql.query('GroupDetailsQuery', () => HttpResponse.json({ data: { group } })),
      ...defaultGraphqlHandlers()
    )
    render(<AuthLayoutRouter />, { wrapper: testWrapper({}, ['/groups/test-group'], seed) })
    await waitForElementToBeRemoved(screen.queryByTestId('loading-screen'))
    await waitFor(() => expect(screen.getByText('Test Group')).toBeInTheDocument())
  }

  const lastIntercomProps = () => mockIntercomProviderProps[mockIntercomProviderProps.length - 1]

  beforeEach(() => {
    mixpanel.identify.mockClear()
    mixpanel.people.set.mockClear()
    mixpanel.set_group.mockClear()
    mixpanel.get_group.mockClear()
    mockIntercomProviderProps.length = 0
  })

  afterEach(() => {
    getCookieConsent.mockReturnValue(null)
  })

  it('sends the Mixpanel profile and boots Intercom for people who have not answered', async () => {
    await renderGroupPage()

    await waitFor(() => expect(mixpanel.people.set).toHaveBeenCalled())
    expect(lastIntercomProps().autoBoot).toBe(true)
  })

  it('sends nothing to Mixpanel and does not boot Intercom after Reject Non-Essential', async () => {
    getCookieConsent.mockReturnValue({ analytics: false, support: false })

    await renderGroupPage()

    expect(mixpanel.identify).not.toHaveBeenCalled()
    expect(mixpanel.people.set).not.toHaveBeenCalled()
    expect(mixpanel.set_group).not.toHaveBeenCalled()
    expect(lastIntercomProps().autoBoot).toBe(false)
    expect(lastIntercomProps().shouldInitialize).toBe(false)
  })

  it('sends nothing to Mixpanel when the rejection is saved only on the account', async () => {
    const cookieConsentPreferences = {
      id: '8f7c2c7e-4a4b-4c1e-9a53-3f0c6a1f2b10',
      settings: { analytics: false, support: false },
      version: '1.0',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }

    await renderGroupPage({ meQueryResult: { ...me, cookieConsentPreferences }, seed: seedCheckLoginMe })

    expect(mixpanel.identify).not.toHaveBeenCalled()
    expect(mixpanel.people.set).not.toHaveBeenCalled()
    expect(mixpanel.set_group).not.toHaveBeenCalled()
    expect(mixpanel.get_group).not.toHaveBeenCalled()
  })

  it('sends the Mixpanel profile once MeQuery shows the account has no saved choice', async () => {
    await renderGroupPage({ seed: seedCheckLoginMe })

    await waitFor(() => expect(mixpanel.people.set).toHaveBeenCalled())
    expect(mixpanel.people.set).toHaveBeenCalledWith(expect.objectContaining({ $email: 'test@example.com' }))
  })
})

describe('finishing signup (D16)', () => {
  const INVITE_PATH = '/groups/test-group/about?token=steward-token'
  const newcomer = {
    id: '1',
    name: 'New Person',
    hasRegistered: true,
    emailValidated: true,
    settings: { signupInProgress: true, alreadySeenTour: true },
    memberships: []
  }
  const signingUp = returnToPath => ({
    authSession: {
      status: 'authenticated',
      userId: '1',
      emailValidated: true,
      hasRegistered: true,
      signupInProgress: true,
      checkedAt: Date.now(),
      transientError: false
    },
    returnToPath
  })

  let navigateSpy, settingsChanges

  beforeEach(() => {
    settingsChanges = []
    navigateSpy = jest.spyOn(require('react-router-dom'), 'Navigate').mockImplementation(() => null)
    useParamsMocked.mockReturnValue({})
    useLocationMocked.mockReturnValue({ pathname: '/signup/finish', search: '' })
    mockGraphqlServer.use(
      graphql.query('MeQuery', () => HttpResponse.json({ data: { me: newcomer } })),
      graphql.operation(({ query, variables }) => {
        if (!query.includes('updateMe(')) return
        settingsChanges.push(variables.changes)
        return HttpResponse.json({
          data: {
            updateMe: {
              id: '1',
              name: 'New Person',
              hasRegistered: true,
              emailValidated: true,
              settings: { signupInProgress: false, profileNudge: variables.changes.settings?.profileNudge || null }
            }
          }
        })
      }),
      ...defaultGraphqlHandlers()
    )
  })

  afterEach(() => navigateSpy.mockRestore())

  const navigatedTo = () => navigateSpy.mock.calls.map(([props]) => props.to)

  it('takes someone who signed up from an invitation straight back to it, skipping the photo and location steps', async () => {
    render(<AuthLayoutRouter />, { wrapper: testWrapper(signingUp(INVITE_PATH), ['/signup/finish']) })

    await waitFor(() => expect(navigatedTo()).toContain(INVITE_PATH))
    expect(navigatedTo()).not.toContain('/welcome')
    expect(settingsChanges).toEqual([{ settings: { signupInProgress: false, profileNudge: 'pending' } }])
  })

  it('still sends everyone else to the welcome steps', async () => {
    render(<AuthLayoutRouter />, { wrapper: testWrapper(signingUp(null), ['/signup/finish']) })

    await waitFor(() => expect(navigatedTo()).toContain('/welcome'))
    expect(settingsChanges).toEqual([])
  })

  it('sends someone who signed up after following an ordinary link to the welcome steps too', async () => {
    render(<AuthLayoutRouter />, { wrapper: testWrapper(signingUp('/groups/test-group/stream'), ['/signup/finish']) })

    await waitFor(() => expect(navigatedTo()).toContain('/welcome'))
    expect(settingsChanges).toEqual([])
  })
})
