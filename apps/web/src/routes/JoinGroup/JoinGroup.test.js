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
import JoinGroup from './JoinGroup'

jest.mock('components/ui/tooltip', () => ({ TooltipProvider: ({ children }) => children }))

afterEach(() => {
  jest.restoreAllMocks()
})

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

it('shows alert and navigates home when invitation is invalid and user is not signed-up', async () => {
  const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
  const navigateMock = jest.fn()

  mockGraphqlServer.use(
    graphql.query('CheckInvitation', () => {
      return HttpResponse.json({
        data: {
          checkInvitation: {
            valid: false
          }
        }
      })
    })
  )

  jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ accessCode: 'anything' })
  jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ pathname: '/join-group', search: '' })
  jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigateMock)

  render(
    <Routes>
      <Route path='/join-group' element={<JoinGroup />} />
    </Routes>,
    { wrapper: currentUserProvider(false) }
  )

  await waitFor(() => {
    expect(alertSpy).toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith('/all')
  })

  alertSpy.mockRestore()
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
