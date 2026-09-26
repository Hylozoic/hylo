import React from 'react'
import { useSelector } from 'react-redux'
import { Route, Routes } from 'react-router-dom'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import getReturnToPath from 'store/selectors/getReturnToPath'
import extractModelsForTest from 'util/testing/extractModelsForTest'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import { AuthSessionStatus } from 'store/reducers/authSession'
import { toast } from 'sonner'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import JoinGroup from './JoinGroup'

jest.mock('components/ui/tooltip', () => ({ TooltipProvider: ({ children }) => children }))
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }))
jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn(() => ({ type: 'TRACK_ANALYTICS_EVENT' })))

const INVALID_INVITE_MESSAGE = 'Sorry, your invitation to this group is expired, has already been used, or is invalid. Please contact a group Host for another one.'

beforeEach(() => {
  jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ pathname: '/join-group', search: '' })
})

afterEach(() => {
  jest.restoreAllMocks()
  toast.error.mockClear()
  trackAnalyticsEvent.mockClear()
})

function mockCheckInvitation (checkInvitation) {
  mockGraphqlServer.use(
    graphql.query('CheckInvitation', () => HttpResponse.json({ data: { checkInvitation } }))
  )
}

function mockGroupViewable (group) {
  const requestedSlugs = []
  mockGraphqlServer.use(
    graphql.query('CheckIsGroupViewable', ({ variables }) => {
      requestedSlugs.push(variables.slug)
      return HttpResponse.json({ data: { group } })
    })
  )
  return requestedSlugs
}

function navigatePropsFor (navigateSpy) {
  return navigateSpy.mock.calls.map(([props]) => props)
}

function currentUserProvider (authStateComplete) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  // Authorization/signup state is now driven by the `authSession` slice, not the ORM `me`.
  const reduxState = {
    orm: ormSession.state,
    authSession: {
      status: AuthSessionStatus.Authenticated,
      userId: '1',
      emailValidated: true,
      hasRegistered: true,
      signupInProgress: !authStateComplete,
      checkedAt: Date.now()
    }
  }

  extractModelsForTest({
    me: {
      id: '1',
      name: 'Test User',
      hasRegistered: true,
      emailValidated: true,
      settings: {
        signupInProgress: !authStateComplete
      },
      memberships: [
        {
          id: '2',
          person: {
            id: '1'
          },
          group: {
            id: '3',
            slug: 'test-group'
          }
        }
      ]
    }
  }, 'Me', ormSession)

  return AllTheProviders(reduxState, ['/join-group'])
}

it('redirects signed-up user to group about page with accessCode when invitation is valid', async () => {
  mockGraphqlServer.use(
    graphql.query('CheckInvitation', () => {
      return HttpResponse.json({
        data: {
          checkInvitation: {
            valid: true,
            groupSlug: 'test-group'
          }
        }
      })
    })
  )

  jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ accessCode: 'test-access-code' })

  render(
    <>
      <Routes>
        <Route path='/join-group' element={<JoinGroup />} />
        <Route
          path='/groups/test-group/about'
          element={<div>/groups/test-group/about?accessCode=test-access-code</div>}
        />
      </Routes>
    </>,
    { wrapper: currentUserProvider(true) }
  )

  await waitFor(() => {
    expect(screen.getByText('/groups/test-group/about?accessCode=test-access-code')).toBeInTheDocument()
  })
})

it('sends a signed-out user with an invalid invitation to signup with the invite error, without an alert', async () => {
  const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
  const navigateSpy = jest.spyOn(require('react-router-dom'), 'Navigate')
  mockCheckInvitation({ valid: false })

  jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ accessCode: 'anything', groupSlug: 'test-group' })
  jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ pathname: '/join-group', search: '' })

  render(
    <Routes>
      <Route path='/join-group' element={<JoinGroup />} />
      <Route path='/signup' element={<div>Signup page</div>} />
    </Routes>,
    { wrapper: currentUserProvider(false) }
  )

  expect(await screen.findByText('Signup page')).toBeInTheDocument()
  expect(navigatePropsFor(navigateSpy)).toContainEqual(expect.objectContaining({ to: '/signup?error=invite-expired' }))
  expect(alertSpy).not.toHaveBeenCalled()
  expect(toast.error).not.toHaveBeenCalled()
})

it('shows a signed-in user a toast and the group about page for an invalid access code to a group they can see', async () => {
  const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
  const navigateSpy = jest.spyOn(require('react-router-dom'), 'Navigate')
  mockCheckInvitation({ valid: false })
  const requestedSlugs = mockGroupViewable({ id: '3', visibility: 2 })

  jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ accessCode: 'expired-code', joinGroupSlug: 'test-group' })
  jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ pathname: '/join-group', search: '' })

  render(
    <Routes>
      <Route path='/join-group' element={<JoinGroup />} />
      <Route path='/groups/test-group/about' element={<div>Test group about page</div>} />
    </Routes>,
    { wrapper: currentUserProvider(true) }
  )

  expect(await screen.findByText('Test group about page')).toBeInTheDocument()
  expect(toast.error).toHaveBeenCalledWith(INVALID_INVITE_MESSAGE, { id: 'invalid-invite' })
  expect(navigatePropsFor(navigateSpy)).toContainEqual(expect.objectContaining({
    to: '/groups/test-group/about',
    state: { invalidInvite: true }
  }))
  expect(requestedSlugs).toEqual(['test-group'])
  expect(alertSpy).not.toHaveBeenCalled()
  expect(trackAnalyticsEvent).not.toHaveBeenCalled()
})

it('keeps the invalid invite message and goes home when the signed-in user cannot see the group', async () => {
  const navigateSpy = jest.spyOn(require('react-router-dom'), 'Navigate')
  mockCheckInvitation({ valid: false })
  const requestedSlugs = mockGroupViewable(null)

  jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ accessCode: 'expired-code', joinGroupSlug: 'hidden-group' })
  jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ pathname: '/join-group', search: '' })

  render(
    <Routes>
      <Route path='/join-group' element={<JoinGroup />} />
      <Route path='/groups/hidden-group/about' element={<div>Hidden group not found</div>} />
      <Route path='/all' element={<div>Home</div>} />
    </Routes>,
    { wrapper: currentUserProvider(true) }
  )

  expect(await screen.findByText('Home')).toBeInTheDocument()
  expect(requestedSlugs).toEqual(['hidden-group'])
  expect(toast.error).toHaveBeenCalledWith(INVALID_INVITE_MESSAGE, { id: 'invalid-invite' })
  expect(screen.queryByText('Hidden group not found')).not.toBeInTheDocument()
  expect(navigatePropsFor(navigateSpy)).not.toContainEqual(expect.objectContaining({ to: '/groups/hidden-group/about' }))
})

it('shows a signed-in user a toast and goes home for an invalid email invitation', async () => {
  mockCheckInvitation({ valid: false })
  const requestedSlugs = mockGroupViewable({ id: '3', visibility: 2 })

  jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({})
  jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ pathname: '/join-group', search: '?token=expired-token' })

  render(
    <Routes>
      <Route path='/join-group' element={<JoinGroup />} />
      <Route path='/all' element={<div>Home</div>} />
    </Routes>,
    { wrapper: currentUserProvider(true) }
  )

  expect(await screen.findByText('Home')).toBeInTheDocument()
  expect(toast.error).toHaveBeenCalledWith(INVALID_INVITE_MESSAGE, { id: 'invalid-invite' })
  expect(requestedSlugs).toEqual([])
})

it('auto-joins a space and opens it when the user is already a parent member', async () => {
  mockGraphqlServer.use(
    graphql.query('CheckInvitation', () => {
      return HttpResponse.json({
        data: {
          checkInvitation: {
            valid: true,
            groupId: '99',
            groupSlug: 'test-group-the-space',
            isSpace: true,
            parentGroupSlug: 'test-group'
          }
        }
      })
    }),
    graphql.mutation('JoinSpace', () => {
      return HttpResponse.json({
        data: {
          joinSpace: {
            id: '55',
            group: {
              id: '99',
              slug: 'test-group-the-space',
              type: 'space',
              parentId: '3'
            },
            person: { id: '1' }
          }
        }
      })
    })
  )

  jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ accessCode: 'space-access-code' })

  render(
    <>
      <Routes>
        <Route path='/join-group' element={<JoinGroup />} />
        <Route
          path='/groups/test-group/spaces/the-space'
          element={<div>/groups/test-group/spaces/the-space?accessCode=space-access-code</div>}
        />
      </Routes>
    </>,
    { wrapper: currentUserProvider(true) }
  )

  await waitFor(() => {
    expect(screen.getByText('/groups/test-group/spaces/the-space?accessCode=space-access-code')).toBeInTheDocument()
  })
})

it('redirects space invites to the parent group about page when the user is not a parent member', async () => {
  mockGraphqlServer.use(
    graphql.query('CheckInvitation', () => {
      return HttpResponse.json({
        data: {
          checkInvitation: {
            valid: true,
            groupSlug: 'the-space',
            isSpace: true,
            parentGroupSlug: 'parent-group'
          }
        }
      })
    })
  )

  jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ accessCode: 'space-access-code' })

  render(
    <>
      <Routes>
        <Route path='/join-group' element={<JoinGroup />} />
        <Route
          path='/groups/parent-group/about'
          element={<div>/groups/parent-group/about?accessCode=space-access-code</div>}
        />
      </Routes>
    </>,
    { wrapper: currentUserProvider(true) }
  )

  await waitFor(() => {
    expect(screen.getByText('/groups/parent-group/about?accessCode=space-access-code')).toBeInTheDocument()
  })
})

it('sets returnToPath and forwards to signup page when invitation is valid and user is not logged-in', async () => {
  mockGraphqlServer.use(
    graphql.query('CheckInvitation', () => {
      return HttpResponse.json({
        data: {
          checkInvitation: {
            valid: true,
            groupSlug: 'test-group'
          }
        }
      })
    })
  )

  jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ accessCode: 'anything' })
  // XXX: I'm not sure this is quite the right way to test this, but couldn't find a better way yet
  jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ pathname: 'route/to/join-group', search: '' })

  const SignupMock = () => {
    const returnToPath = useSelector(getReturnToPath)
    return (
      <>
        <div>{returnToPath}</div>
      </>
    )
  }

  render(
    <>
      <Routes>
        <Route path='/join-group' element={<JoinGroup />} />
        <Route path='/signup' element={<SignupMock />} />
      </Routes>
    </>,
    { wrapper: currentUserProvider(false) }
  )

  await waitFor(() => {
    expect(screen.getByText('/groups/test-group/about?accessCode=anything')).toBeInTheDocument()
  })
})

it('prefills signup with the invited email for a signed-out email invitation', async () => {
  const navigateSpy = jest.spyOn(require('react-router-dom'), 'Navigate')
  mockCheckInvitation({ valid: true, groupId: '3', groupSlug: 'test-group', email: 'invited@hylo.com' })

  jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({})
  jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ pathname: '/join-group', search: '?token=invite-token' })

  render(
    <Routes>
      <Route path='/join-group' element={<JoinGroup />} />
      <Route path='/signup' element={<div>Signup page</div>} />
    </Routes>,
    { wrapper: currentUserProvider(false) }
  )

  expect(await screen.findByText('Signup page')).toBeInTheDocument()
  expect(navigatePropsFor(navigateSpy)).toContainEqual(expect.objectContaining({
    to: '/signup',
    state: { email: 'invited@hylo.com' }
  }))
})

it('falls back to the email in the invitation link when prefilling signup', async () => {
  const navigateSpy = jest.spyOn(require('react-router-dom'), 'Navigate')
  mockCheckInvitation({ valid: true, groupId: '3', groupSlug: 'test-group', email: null })

  jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({})
  jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ pathname: '/join-group', search: '?token=invite-token&email=link%40hylo.com' })

  render(
    <Routes>
      <Route path='/join-group' element={<JoinGroup />} />
      <Route path='/signup' element={<div>Signup page</div>} />
    </Routes>,
    { wrapper: currentUserProvider(false) }
  )

  expect(await screen.findByText('Signup page')).toBeInTheDocument()
  expect(navigatePropsFor(navigateSpy)).toContainEqual(expect.objectContaining({
    to: '/signup',
    state: { email: 'link@hylo.com' }
  }))
})

it('tracks Invite Link Opened once the invitation is valid', async () => {
  mockCheckInvitation({ valid: true, groupId: '3', groupSlug: 'test-group' })

  jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ accessCode: 'test-access-code' })
  jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ pathname: '/join-group', search: '' })

  render(
    <Routes>
      <Route path='/join-group' element={<JoinGroup />} />
      <Route path='/groups/test-group/about' element={<div>Test group about page</div>} />
    </Routes>,
    { wrapper: currentUserProvider(true) }
  )

  expect(await screen.findByText('Test group about page')).toBeInTheDocument()
  expect(trackAnalyticsEvent).toHaveBeenCalledWith('Invite Link Opened', { groupId: '3', method: 'code', signedIn: true })
})

it('tracks Invite Link Opened for a signed-out email invitation', async () => {
  mockCheckInvitation({ valid: true, groupId: '3', groupSlug: 'test-group', email: 'invited@hylo.com' })

  jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({})
  jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ pathname: '/join-group', search: '?token=invite-token' })

  render(
    <Routes>
      <Route path='/join-group' element={<JoinGroup />} />
      <Route path='/signup' element={<div>Signup page</div>} />
    </Routes>,
    { wrapper: currentUserProvider(false) }
  )

  expect(await screen.findByText('Signup page')).toBeInTheDocument()
  expect(trackAnalyticsEvent).toHaveBeenCalledWith('Invite Link Opened', { groupId: '3', method: 'token', signedIn: false })
})
