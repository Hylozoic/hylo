import React from 'react'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import extractModelsForTest from 'util/testing/extractModelsForTest'
import orm from 'store/models'
import UserSettings from './UserSettings'

describe('UserSettings', () => {
  let reduxState

  beforeAll(() => {
    const currentUser = {
      id: '1',
      hasFeature: () => true,
      blockedUsers: ['a user'],
      settings: {}
    }
    const memberships = [
      { id: '2', settings: {}, person: currentUser },
      { id: '3', settings: {}, person: currentUser }
    ]

    const ormSession = orm.session(orm.getEmptyState())
    extractModelsForTest({
      me: currentUser,
      memberships
    }, ['Me', 'Membership'], ormSession)

    reduxState = {
      orm: ormSession.state,
      Authentication: { isLoggedIn: true },
      FullPageModal: { confirm: false },
      pending: { FETCH_FOR_CURRENT_USER: false }
    }
  })

  it('renders correctly', () => {
    render(
      <UserSettings />,
      { wrapper: AllTheProviders(reduxState) }
    )

    // Check if main sections are rendered
    expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    expect(screen.getByText('Groups & Affiliations')).toBeInTheDocument()
    expect(screen.getByText('Invites & Requests')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Saved Searches')).toBeInTheDocument()
    expect(screen.getByText('Blocked Users')).toBeInTheDocument()
    expect(screen.getByText('Payment')).toBeInTheDocument()
  })

  it('does not render Blocked Users tab when user has no blocked users', () => {
    // Update the currentUser to have no blocked users
    const currentUserWithNoBlockedUsers = {
      ...reduxState.orm.Me.itemsById['1'],
      blockedUsers: []
    }
    reduxState.orm.Me.withId('1').update(currentUserWithNoBlockedUsers)

    render(
      <UserSettings />,
      { wrapper: AllTheProviders(reduxState) }
    )

    expect(screen.queryByText('Blocked Users')).not.toBeInTheDocument()
  })

  it('does not render Payment tab when user does not have PROJECT_CONTRIBUTIONS feature', () => {
    // Update the currentUser to have no blocked users
    const currentUserWithNoBlockedUsers = {
      ...reduxState.orm.Me.itemsById['1'],
      hasFeature: () => false
    }
    reduxState.orm.Me.withId('1').update(currentUserWithNoBlockedUsers)

    render(
      <UserSettings />,
      { wrapper: AllTheProviders(reduxState) }
    )

    expect(screen.queryByText('Payment')).not.toBeInTheDocument()
  })
})
