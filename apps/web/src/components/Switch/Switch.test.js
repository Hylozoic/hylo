import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import Switch from './Switch'

describe('Switch', () => {
  it('renders correctly and responds to clicks', () => {
    const mockOnClick = jest.fn()
    const { container } = render(
      <Switch value onClick={mockOnClick} className='custom-class' />
    )

    // Check if the switch is rendered with the correct classes
    const switchElement = container.firstChild
    expect(switchElement).toHaveClass('custom-class')
    expect(switchElement).toHaveClass('switchContainer')

    // Check if the switch is in the "on" state
    const switchStateElement = switchElement.lastChild
    expect(switchStateElement).toHaveClass('switchOn')

    // Simulate a click on the switch
    fireEvent.click(switchElement)

    // Check if the onClick handler was called
    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('renders in the "off" state', () => {
    const { container } = render(<Switch value={false} onClick={() => {}} />)

    // Check if the switch is in the "off" state
    const switchStateElement = container.firstChild.lastChild
    expect(switchStateElement).toHaveClass('switchOff')
  })
})
