import React from 'react'
import { useSelector } from 'react-redux'
import { Route, Routes, useLocation } from 'react-router-dom'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import getReturnToPath from 'store/selectors/getReturnToPath'
import extractModelsForTest from 'util/testing/extractModelsForTest'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import JoinGroup, { SIGNUP_PATH } from './JoinGroup'

function currentUserProvider (authStateComplete) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  const reduxState = { orm: ormSession.state }

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

it('joins and forwards to group when current user is fully signed-up', async () => {
  const testMembership = {
    id: '2',
    group: {
      id: '3',
      slug: 'test-group'
    }
  }

  mockGraphqlServer.use(
    graphql.mutation('UseInvitation', () => {
      return HttpResponse.json({
        data: {
          useInvitation: {
            membership: testMembership
          }
        }
      })
    }),
    graphql.query('FetchForGroup', () => {
      return HttpResponse.json({
        data: {
          group: testMembership.group
        }
      })
    })
  )

  jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ accessCode: 'anything' })
  // jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ search: '' })

  render(
    <>
      <Routes>
        <Route path='/join-group' element={<JoinGroup />} />
        <Route path='/groups/test-group/explore' element={<div>/groups/test-group/explore</div>} />
      </Routes>
    </>,
    { wrapper: currentUserProvider(true) }
  )

  await waitFor(() => {
    expect(screen.getByText('/groups/test-group/explore')).toBeInTheDocument()
  })
})

it('checks invitation and forwards to expired invite page when invitation is invalid when not logged-in', async () => {
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
  jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ pathname: '/signup', search: 'error=invalid-invite' })

  const SignupMock = () => {
    const location = useLocation()
    return <div>signup mock {location.pathname}?{location.search}</div>
  }

  render(
    <>
      <JoinGroup />
      <Routes>
        <Route path='/join-group' element={<JoinGroup />} />
        <Route path='/signup' element={<SignupMock />} />
      </Routes>
    </>,
    { wrapper: currentUserProvider(false) }
  )

  await waitFor(() => {
    expect(screen.getByText(`${SIGNUP_PATH}?error=invalid-invite`, { exact: false })).toBeInTheDocument()
  })
})

it('sets returnToPath and forwards to signup page when invitation is valid and user is not logged-in', async () => {
  mockGraphqlServer.use(
    graphql.query('CheckInvitation', () => {
      return HttpResponse.json({
        data: {
          checkInvitation: {
            valid: true
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
    )  }

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
    expect(screen.getByText('route/to/join-group')).toBeInTheDocument()
  })
})
