import React from 'react'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import UserGroupsTab from './UserGroupsTab'

describe('UserGroupsTab', () => {
  it('renders a list of Memberships and Affiliations', () => {
    const props = {
      memberships: [
        { id: '1', group: { name: 'Group 1' } },
        { id: '2', group: { name: 'Group 2' } },
        { id: '3', group: { name: 'Group 3' } }
      ],
      affiliations: {
        items: [
          {
            id: '1',
            role: 'Cheesemonger',
            preposition: 'at',
            orgName: 'La Fromagerie',
            url: 'https://www.lafromagerie.com',
            isActive: true
          },
          {
            id: '2',
            role: 'Organizer',
            preposition: 'of',
            orgName: 'Rights of Nature Santa Cruz',
            url: 'https://rightsofnaturesc.org',
            isActive: true
          }
        ]
      },
      updateAllGroups: () => {},
      fetchForCurrentUser: jest.fn(() => Promise.resolve({ id: 'validUser' }))
    }

    render(<UserGroupsTab {...props} />, { wrapper: AllTheProviders })

    // Check for Memberships
    expect(screen.getByText('Group 1')).toBeInTheDocument()
    expect(screen.getByText('Group 2')).toBeInTheDocument()
    expect(screen.getByText('Group 3')).toBeInTheDocument()

    // Check for Affiliations
    expect(screen.getByText('Cheesemonger at La Fromagerie')).toBeInTheDocument()
    expect(screen.getByText('Organizer of Rights of Nature Santa Cruz')).toBeInTheDocument()

    // Check for section headers
    expect(screen.getByText('Hylo Groups')).toBeInTheDocument()
    expect(screen.getByText('Other Affiliations')).toBeInTheDocument()
  })

  it('displays loading state when data is not available', () => {
    const props = {
      memberships: null,
      affiliations: null,
      updateAllGroups: () => {},
      fetchForCurrentUser: jest.fn(() => Promise.resolve({ id: 'validUser' }))
    }

    render(<UserGroupsTab {...props} />, { wrapper: AllTheProviders })

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('allows adding a new affiliation', () => {
    const props = {
      memberships: [],
      affiliations: { items: [] },
      updateAllGroups: () => {},
      fetchForCurrentUser: jest.fn(() => Promise.resolve({ id: 'validUser' }))
    }

    render(<UserGroupsTab {...props} />, { wrapper: AllTheProviders })

    const addButton = screen.getByText('Add new affiliation')
    expect(addButton).toBeInTheDocument()

    addButton.click()

    expect(screen.getByPlaceholderText('Name of role')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Name of organization')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('URL of organization')).toBeInTheDocument()
  })
})
