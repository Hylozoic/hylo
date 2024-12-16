import React from 'react'
import orm from 'store/models'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import ManageNotifications from './ManageNotifications'

jest.mock('store/middleware/apiMiddleware', () => (req) => {
  return store => next => action => {
    return Promise.resolve({ ...action, payload: Promise.resolve({ commentNotifications: 'email', dmNotifications: 'push', postNofications: 'important', digestFrequency: 'daily', allGroupNotifications: 'both' }) })
  }
})

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  const reduxState = { orm: ormSession.state }
  return AllTheProviders(reduxState)
}

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockReturnValue({ name: 'Philharmonic', token: 'hjkhkjhkjh' }),
  // useLocation: jest.fn().mockReturnValue({  })
}))

describe('ManageNotifications', () => {
  it('renders correctly', async () => {
    render(
      <ManageNotifications />,
      { wrapper: testProviders() }
    )

    await waitFor(() => {
      expect(screen.getByText('Hi Philharmonic')).toBeInTheDocument()
    })
  })
})
