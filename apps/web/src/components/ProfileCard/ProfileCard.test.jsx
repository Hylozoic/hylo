import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import ProfileCard from './ProfileCard'

const person = {
  id: '2',
  name: 'Ada Lovelace',
  avatarUrl: 'ada.png',
  bannerUrl: 'ada-banner.png',
  tagline: 'First programmer',
  location: 'London',
  bio: '<p>Mathematician</p>'
}

describe('ProfileCard', () => {
  it('renders name, tagline, avatar and banner', () => {
    render(<ProfileCard person={person} onViewProfile={jest.fn()} />)
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('First programmer')).toBeInTheDocument()
    expect(screen.getByTestId('profile-card-banner').style.backgroundImage).toContain('ada-banner.png')
    expect(screen.getByText('View Profile')).toBeInTheDocument()
  })

  it('falls back to the default banner', () => {
    render(<ProfileCard person={{ ...person, bannerUrl: null }} onViewProfile={jest.fn()} />)
    expect(screen.getByTestId('profile-card-banner').style.backgroundImage).toContain('default-user-banner.svg')
  })

  it('renders roles when given', () => {
    render(<ProfileCard person={person} roles={[{ id: '7', name: 'Gardener', emoji: '🌱' }]} onViewProfile={jest.fn()} />)
    expect(screen.getByTestId('profile-card-roles')).toBeInTheDocument()
    expect(screen.getByText('Gardener')).toBeInTheDocument()
  })

  it('omits the roles section without roles', () => {
    render(<ProfileCard person={person} onViewProfile={jest.fn()} />)
    expect(screen.queryByTestId('profile-card-roles')).not.toBeInTheDocument()
  })

  it('shows the Message button only when messaging is allowed', () => {
    const { rerender } = render(<ProfileCard person={person} onViewProfile={jest.fn()} />)
    expect(screen.queryByText('Message')).not.toBeInTheDocument()
    rerender(<ProfileCard person={person} onMessage={jest.fn()} onViewProfile={jest.fn()} />)
    expect(screen.getByText('Message')).toBeInTheDocument()
  })

  it('shows location and bio only with showDetails', () => {
    const { rerender } = render(<ProfileCard person={person} onViewProfile={jest.fn()} />)
    expect(screen.queryByText('London')).not.toBeInTheDocument()
    rerender(<ProfileCard person={person} showDetails onViewProfile={jest.fn()} />)
    expect(screen.getByText('London')).toBeInTheDocument()
    expect(screen.getByText('Mathematician')).toBeInTheDocument()
  })
})
