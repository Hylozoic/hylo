import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

import DropdownButton from './DropdownButton'

describe('DropdownButton', () => {
  it('renders correctly and basic functions work', () => {
    const props = {
      label: 'Log in',
      choices: [{ label: 'one', value: 1 }, { label: 'two', value: 2 }],
      className: 'login',
      onChoose: jest.fn()
    }

    render(<DropdownButton {...props} />)

    // Check if the button is rendered with the correct label
    const button = screen.getByRole('button', { name: /Log in/i })
    expect(button).toBeInTheDocument()

    // Check if the dropdown is initially closed (options are present but hidden)
    const optionOne = screen.getByText('one')
    const optionTwo = screen.getByText('two')
    expect(optionOne).toBeInTheDocument()
    expect(optionTwo).toBeInTheDocument()
    const dropdownChoices = screen.getByTestId('dropdown-button-choices')
    expect(dropdownChoices).not.toHaveClass('expanded')

    // Open the dropdown
    fireEvent.click(button)

    // Check if the dropdown options are now visible
    expect(screen.getByText('one')).toBeInTheDocument()
    expect(screen.getByText('two')).toBeInTheDocument()
    expect(dropdownChoices).toHaveClass('expanded')

    // Choose an option
    fireEvent.click(screen.getByText('one'))

    // Check if the dropdown is closed after selection
    expect(dropdownChoices).not.toHaveClass('expanded')

    // Check if the onChoose prop was called with the correct value
    expect(props.onChoose).toHaveBeenCalledWith(1)

    // Reopen the dropdown
    fireEvent.click(button)

    // Close the dropdown by clicking the button again
    fireEvent.click(button)

    // Check if the dropdown is closed
    expect(dropdownChoices).not.toHaveClass('expanded')
  })
})
