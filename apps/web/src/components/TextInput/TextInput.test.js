import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import TextInput from './TextInput'

describe('TextInput', () => {
  it('renders correctly with a value', () => {
    const onChange = jest.fn()
    render(<TextInput onChange={onChange} value='test value' />)

    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('test value')
  })

  it('calls onChange when input value changes', () => {
    const onChange = jest.fn()
    render(<TextInput onChange={onChange} value='' />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'new value' } })

    expect(onChange).toHaveBeenCalled()
  })

  it('renders clear button when value is present', () => {
    render(<TextInput onChange={() => {}} value='test value' />)

    const clearButton = screen.getByRole('button', { name: /clear/i })
    expect(clearButton).toBeInTheDocument()
  })

  it('clears input when clear button is clicked', () => {
    const onChange = jest.fn()
    render(<TextInput onChange={onChange} value='test value' />)

    const clearButton = screen.getByRole('button', { name: /clear/i })
    fireEvent.click(clearButton)

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      target: expect.objectContaining({ value: '' })
    }))
  })

  it('renders loading indicator when loading prop is true', () => {
    render(<TextInput onChange={() => {}} value='' loading />)

    const loadingIndicator = screen.getByTestId('loading-indicator')
    expect(loadingIndicator).toBeInTheDocument()
  })

  it('renders internal label when provided', () => {
    render(<TextInput onChange={() => {}} value='' internalLabel='Username' />)

    const label = screen.getByText('Username')
    expect(label).toBeInTheDocument()
  })
})
