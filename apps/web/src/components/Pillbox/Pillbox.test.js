import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import Pillbox from './Pillbox'

describe('Pillbox', () => {
  it('renders pills correctly', () => {
    const pills = [
      { id: 1, label: 'a pill' },
      { id: 2, label: 'another pill' }
    ]

    render(<Pillbox pills={pills} />)

    // Check if both pills are rendered
    expect(screen.getByText('a pill')).toBeInTheDocument()
    expect(screen.getByText('another pill')).toBeInTheDocument()
  })
})
