import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import Member from './Member'
import { RESP_ADMINISTRATION, RESP_REMOVE_MEMBERS } from 'store/constants'

const minProps = {
  group: { id: 1, slug: 'test-group' },
  currentUser: { id: 1, memberships: [{ id: 1, groupId: 1 }] },
  currentUserResponsibilities: [],
  member: {
    id: '1',
    name: 'Test Member',
    location: 'Test Location',
    tagline: 'Test Tagline',
    avatarUrl: 'test-avatar.jpg',
    skills: [{ name: 'Test Skill' }]
  },
  roles: [],
  goToPerson: jest.fn(),
  removeMember: jest.fn(),
  t: (key, options) => key // Mock translation function
}

describe('Member Component', () => {
  it('renders member information', () => {
    render(<Member {...minProps} />)

    expect(screen.getByText('Test Member')).toBeInTheDocument()
    expect(screen.getByText('Test Location')).toBeInTheDocument()
    expect(screen.getByText('Test Tagline')).toBeInTheDocument()
    expect(screen.getByText('Test Skill')).toBeInTheDocument()
  })

  it('shows moderate button when current user has remove members responsibility', () => {
    render(<Member {...minProps} currentUserResponsibilities={[RESP_ADMINISTRATION, RESP_REMOVE_MEMBERS]} />)

    expect(screen.getByTestId('dropdown-toggle')).toBeInTheDocument()
  })

  it('hides moderate button when current user does not have remove members responsibility', () => {
    render(<Member {...minProps} />)

    expect(screen.queryByTestId('dropdown-toggle')).not.toBeInTheDocument()
  })

  it('calls goToPerson when clicking on member information', () => {
    const goToPerson = jest.fn().mockReturnValue(jest.fn())
    render(<Member {...minProps} goToPerson={goToPerson} />)

    screen.getByText('Test Member').click()
    expect(goToPerson).toHaveBeenCalledWith('1', 'test-group')
  })

  it('renders roles as badges', () => {
    const roles = [
      { id: '1', name: 'Role 1', emoji: '🏆', responsibilities: [] },
      { id: '2', name: 'Role 2', emoji: '🎉', responsibilities: [] }
    ]
    render(<Member {...minProps} roles={roles} />)

    expect(screen.getByText('🏆')).toBeInTheDocument()
    expect(screen.getByText('🎉')).toBeInTheDocument()
  })
})
