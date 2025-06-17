import React from 'react'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import WelcomeExplore from './WelcomeExplore'

describe('WelcomeExplore', () => {
  it('renders correctly with user name', () => {
    render(
      <WelcomeExplore currentUser={{ name: 'Tibet Sprout' }} />
    )

    expect(screen.getByText('Welcome to Hylo!')).toBeInTheDocument()
    expect(screen.getByText(/We're glad you're here, Tibet./)).toBeInTheDocument()
  })

  it('renders all navigation links', () => {
    render(
      <WelcomeExplore currentUser={{ name: 'Tibet Sprout' }} />
    )

    expect(screen.getByRole('link', { name: /View the public map/i })).toHaveAttribute('href', '/public/map?hideDrawer=true')
    expect(screen.getByRole('link', { name: /Public stream/i })).toHaveAttribute('href', '/public/stream')
    expect(screen.getByRole('link', { name: /Create a group/i })).toHaveAttribute('href', '/create-group?closePath=%2Fpublic')
    expect(screen.getByRole('link', { name: /Complete your profile/i })).toHaveAttribute('href', '/my/edit-profile')
  })

  it('displays user avatar when provided', () => {
    const avatarUrl = 'https://example.com/avatar.jpg'
    render(
      <WelcomeExplore currentUser={{ name: 'Tibet Sprout', avatarUrl }} />
    )

    const profileImage = screen.getByText('Complete your profile').closest('div').previousSibling
    expect(profileImage).toHaveStyle(`background-image: url(${avatarUrl})`)
  })
})
