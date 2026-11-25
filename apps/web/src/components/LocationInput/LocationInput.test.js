import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import LocationInput from './LocationInput'

describe('LocationInput', () => {
  const defaultProps = {
    mapboxToken: 'test-token',
    onChange: jest.fn(),
    pollingFetchLocation: jest.fn()
  }

  it('renders correctly with minimum props', () => {
    render(<LocationInput {...defaultProps} />)
    expect(screen.getByPlaceholderText('Search for a location...')).toBeInTheDocument()
  })

  it('renders correctly with custom location', () => {
    render(<LocationInput {...defaultProps} location='123 Main St. San Francisco, CA' />)
    expect(screen.getByDisplayValue('123 Main St. San Francisco, CA')).toBeInTheDocument()
  })

  it('renders correctly with custom placeholder', () => {
    render(<LocationInput {...defaultProps} placeholder='Enter your address' />)
    expect(screen.getByPlaceholderText('Enter your address')).toBeInTheDocument()
  })

  it('renders when the browser has no geolocation', () => {
    const originalGeolocation = navigator.geolocation
    navigator.geolocation = undefined
    try {
      render(<LocationInput {...defaultProps} />)
      expect(screen.getByPlaceholderText('Search for a location...')).toBeInTheDocument()
    } finally {
      navigator.geolocation = originalGeolocation
    }
  })
})
