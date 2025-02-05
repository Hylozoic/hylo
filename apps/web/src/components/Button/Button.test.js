import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import Button from './Button'

describe('Button', () => {
  it('renders correctly with given props', () => {
    const onClick = jest.fn()
    render(
      <Button
        label='Log in'
        color='blue'
        hover
        active
        narrow
        small
        onClick={onClick}
        disabled={false}
        className='login'
      />
    )

    const button = screen.getByRole('button', { name: 'Log in' })

    // Check if the button is rendered with correct text
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Log in')

    // Check for applied classes
    expect(button).toHaveClass('blue', 'hover', 'active', 'narrow', 'small', 'login')
    expect(button).not.toHaveClass('disabled')

    // Check if onClick works
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders disabled button correctly', () => {
    const onClick = jest.fn()
    render(
      <Button
        label='Disabled Button'
        disabled
        onClick={onClick}
      />
    )

    const button = screen.getByRole('button', { name: 'Disabled Button' })

    expect(button).toHaveClass('disabled')

    // Check if onClick doesn't work when disabled
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders children instead of label when provided', () => {
    render(
      <Button>
        <span>Child Content</span>
      </Button>
    )

    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('Child Content')
  })
})
