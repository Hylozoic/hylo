import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import TopNavDropdown from './TopNavDropdown'

const topNavPosition = {
  rightX: 1280,
  height: 56
}

describe('TopNavDropdown', () => {
  it('renders correctly and toggles active state', () => {
    const toggleChildren = <div>toggle</div>
    const header = <div>header</div>
    const body = <div>body</div>

    render(
      <TopNavDropdown
        topNavPosition={topNavPosition}
        toggleChildren={toggleChildren}
        header={header}
        body={body}
      />
    )

    // Check if toggle children are rendered
    expect(screen.getByText('toggle')).toBeInTheDocument()

    // Check if the dropdown is initially closed
    expect(screen.getByTestId('top-nav-dropdown-wrapper')).not.toHaveClass('active')

    // Click the toggle to open the dropdown
    fireEvent.click(screen.getByText('toggle'))

    // Check if the dropdown is now open
    expect(screen.getByTestId('top-nav-dropdown-wrapper')).toHaveClass('active')

    // Check if the wrapper has the correct classes
    const wrapper = screen.getByTestId('top-nav-dropdown-wrapper')
    expect(wrapper).toHaveClass('wrapper')
    expect(wrapper).toHaveClass('animateFadeInDown')
    expect(wrapper).toHaveClass('active')

    // Click the toggle again to close the dropdown
    fireEvent.click(screen.getByText('toggle'))

    // Check if the dropdown is closed
    expect(screen.getByTestId('top-nav-dropdown-wrapper')).not.toHaveClass('active')
  })
})
