import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import AddLocation from './AddLocation'

describe('AddLocation', () => {
  it('renders the location input and instructions', () => {
    render(<AddLocation />)

    // Check for the step count
    expect(screen.getByText('STEP 2/3')).toBeInTheDocument()

    // Check for the location input
    expect(screen.getByPlaceholderText('Where do you call home?')).toBeInTheDocument()

    // Check for the instructions
    expect(screen.getByText('Add your location to see more relevant content, and find people and projects around you.')).toBeInTheDocument()

    // Check for the footer buttons
    expect(screen.getByText('Next: Welcome to Hylo!')).toBeInTheDocument()
  })
})
