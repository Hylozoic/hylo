import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
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
    expect(optionOne).not.toBeVisible()
    expect(optionTwo).not.toBeVisible()

    // Open the dropdown
    fireEvent.click(button)

    // Check if the dropdown options are now visible
    expect(screen.getByText('one')).toBeInTheDocument()
    expect(screen.getByText('two')).toBeInTheDocument()
    expect(screen.getByText('one')).toBeVisible()
    expect(screen.getByText('two')).toBeVisible()

    // Choose an option
    fireEvent.click(screen.getByText('one'))

    // Check if the dropdown is closed after selection
    expect(screen.queryByText('one')).not.toBeVisible()
    expect(screen.queryByText('two')).not.toBeVisible()

    // Check if the onChoose prop was called with the correct value
    expect(props.onChoose).toHaveBeenCalledWith(1)

    // Reopen the dropdown
    fireEvent.click(button)

    // Close the dropdown by clicking the button again
    fireEvent.click(button)

    // Check if the dropdown is closed
    expect(screen.queryByText('one')).not.toBeVisible()
    expect(screen.queryByText('two')).not.toBeVisible()
  })
})
