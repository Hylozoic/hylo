import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import Member from './Member'

const minProps = {
  group: { id: '1', slug: 'test-group' },
  member: {
    id: '1',
    name: 'Test Member',
    location: 'Test Location',
    tagline: 'Test Tagline',
    avatarUrl: 'test-avatar.jpg'
  },
  removeMember: jest.fn()
}

describe('Member Component', () => {
  it('renders member information', () => {
    render(<Member {...minProps} />)

    expect(screen.getByText('Test Member')).toBeInTheDocument()
    expect(screen.getByText('Test Location')).toBeInTheDocument()
    expect(screen.getByText('Test Tagline')).toBeInTheDocument()
    expect(screen.getByTestId('member-card')).toBeInTheDocument()
  })

  it('renders square layout when square prop is set', () => {
    render(<Member {...minProps} square />)

    expect(screen.getByTestId('member-card')).toBeInTheDocument()
    expect(screen.getByText('Test Member')).toBeInTheDocument()
  })

  it('renders the join date, with no dot for a long-inactive member', () => {
    const { container } = render(
      <Member
        {...minProps}
        member={{
          ...minProps.member,
          enrolledAt: '2024-01-15T00:00:00.000Z',
          lastActiveAt: '2025-06-01T00:00:00.000Z'
        }}
      />
    )

    expect(screen.getByText(/Joined/)).toBeInTheDocument()
    expect(container.querySelector('.bg-green-500')).not.toBeInTheDocument()
  })

  it('wears a green dot on the avatar for recently active members', () => {
    const { container } = render(
      <Member
        {...minProps}
        member={{
          ...minProps.member,
          lastActiveAt: String(Date.now())
        }}
      />
    )

    expect(container.querySelector('.bg-green-500')).toBeInTheDocument()
  })
})
