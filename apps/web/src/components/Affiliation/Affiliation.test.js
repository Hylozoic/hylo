import React from 'react'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import Affiliation from './Affiliation'

describe('Affiliation', () => {
  it('renders affiliation details correctly', () => {
    const props = {
      affiliation: {
        id: '1',
        orgName: 'La Fromagerie',
        preposition: 'at',
        role: 'Cheesemonger',
        url: null,
        createdAt: '2020-12-09T23:01:17.431Z',
        updatedAt: '2020-12-09T23:01:17.431Z',
        isActive: true
      }
    }

    render(<Affiliation {...props} />, { wrapper: AllTheProviders() })

    // Check if the role is rendered
    expect(screen.getByText('Cheesemonger')).toBeInTheDocument()

    // Check if the preposition is rendered
    expect(screen.getByText('at')).toBeInTheDocument()

    // Check if the organization name is rendered
    expect(screen.getByText('La Fromagerie')).toBeInTheDocument()

    // Check that the delete button is not rendered when archive prop is not provided
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })

  // Add more tests as needed
})
