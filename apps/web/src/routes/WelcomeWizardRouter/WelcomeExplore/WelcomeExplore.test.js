import React from 'react'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import WelcomeExplore from './WelcomeExplore'

function providersWithUser (user) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create(user)
  return AllTheProviders({ orm: ormSession.state })
}

describe('WelcomeExplore', () => {
  it('renders correctly with user name', () => {
    render(
      <WelcomeExplore />,
      { wrapper: providersWithUser({ id: '1', name: 'Tibet Sprout' }) }
    )

    expect(screen.getByText('Welcome to Hylo!')).toBeInTheDocument()
    expect(screen.getByText(/We're glad you're here, Tibet./)).toBeInTheDocument()
  })

  it('renders all navigation links', () => {
    render(
      <WelcomeExplore />,
      { wrapper: providersWithUser({ id: '1', name: 'Tibet Sprout' }) }
    )

    expect(screen.getByRole('link', { name: /View the public map/i })).toHaveAttribute('href', '/public/map?hideDrawer=true')
    expect(screen.getByRole('link', { name: /Public stream/i })).toHaveAttribute('href', '/public/all')
    expect(screen.getByRole('link', { name: /Create a group/i })).toHaveAttribute('href', '/public?createGroup=true')
    expect(screen.getByRole('link', { name: /Complete your profile/i })).toHaveAttribute('href', '/my/edit-profile')
  })

  it('displays user avatar when provided', () => {
    const avatarUrl = 'https://example.com/avatar.jpg'
    const { container } = render(
      <WelcomeExplore />,
      { wrapper: providersWithUser({ id: '1', name: 'Tibet Sprout', avatarUrl }) }
    )

    expect(container.innerHTML).toContain(avatarUrl)
  })
})
