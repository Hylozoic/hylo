import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import CheckBox from './CheckBox'

describe('CheckBox', () => {
  it('renders correctly when checked', () => {
    render(<CheckBox checked onChange={() => {}} className='box' />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).toBeChecked()
    expect(checkbox).toHaveClass('box')

    const icon = screen.getByTestId('icon-Checkmark')
    expect(icon).toBeInTheDocument()
  })

  it('renders correctly when unchecked', () => {
    render(<CheckBox checked={false} onChange={() => {}} />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).not.toBeChecked()

    const icon = screen.getByTestId('icon-Empty')
    expect(icon).toBeInTheDocument()
  })

  it('calls onChange when clicked', () => {
    const handleChange = jest.fn()
    render(<CheckBox checked={false} onChange={handleChange} />)

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it('renders with label', () => {
    render(<CheckBox label='Test Label' onChange={() => {}} />)

    const label = screen.getByText('Test Label')
    expect(label).toBeInTheDocument()
  })

  it('renders with left label', () => {
    render(<CheckBox label='Left Label' labelLeft onChange={() => {}} />)

    const label = screen.getByText('Left Label')
    expect(label).toBeInTheDocument()
    // You might want to add a more specific test for left positioning if needed
  })

  it('renders disabled checkbox', () => {
    render(<CheckBox disabled onChange={() => {}} />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeDisabled()
  })
})
