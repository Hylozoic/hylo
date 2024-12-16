import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PostTitle from './index'

describe('PostTitle', () => {
  const defaultProps = {
    title: 'Hello there',
    location: 'New York, NY',
    locationObject: { city: 'New York', region: 'NY' },
    type: 'post',
    onClick: jest.fn(),
    highlightProps: { term: 'Hello' }
  }

  it('renders the title correctly', () => {
    render(<PostTitle {...defaultProps} />)
    expect(screen.getByText('Hello there')).toBeInTheDocument()
  })

  it('renders the location for non-event posts', () => {
    render(<PostTitle {...defaultProps} />)
    expect(screen.getByText('New York, NY')).toBeInTheDocument()
    expect(screen.getByTestId('icon-Location')).toBeInTheDocument()
  })

  it('does not render location for event posts', () => {
    render(<PostTitle {...defaultProps} type="event" />)
    expect(screen.queryByText('New York, NY')).not.toBeInTheDocument()
    expect(screen.queryByTestId('icon-Location')).not.toBeInTheDocument()
  })

  it('applies constrained class when constrained prop is true', () => {
    render(<PostTitle {...defaultProps} constrained={true} />)
    expect(screen.getByText('Hello there')).toHaveClass('constrained')
  })

  it('calls onClick when title is clicked', () => {
    render(<PostTitle {...defaultProps} />)
    screen.getByText('Hello there').click()
    expect(defaultProps.onClick).toHaveBeenCalled()
  })

  it.skip('applies highlight to the title', () => {
    render(<PostTitle {...defaultProps} />)
    expect(screen.getByText('Hello')).toHaveClass('highlight')
  })
})
