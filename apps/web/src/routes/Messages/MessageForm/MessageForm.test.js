import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import { AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import MessageForm from './MessageForm'
import { keyMap } from 'util/textInput'

const messageThreadId = '1'
const currentUser = {
  id: '1',
  avatarUrl: 'http://image.com/p.png'
}

const defaultProps = {
  focusForm: jest.fn(),
  messageThreadId,
  messageText: 'hey you',
  currentUser,
  participants: [],
  updateMessageText: jest.fn(),
  onSubmit: jest.fn(),
  sendIsTyping: jest.fn()
}

describe('MessageForm', () => {
  it('renders the message form with textarea and send button', () => {
    render(<MessageForm {...defaultProps} />, { wrapper: AllTheProviders })

    expect(screen.getByPlaceholderText('Write something...')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('displays the current message text', () => {
    render(<MessageForm {...defaultProps} />, { wrapper: AllTheProviders })

    expect(screen.getByDisplayValue('hey you')).toBeInTheDocument()
  })

  it('calls sendIsTyping when typing happens', () => {
    render(<MessageForm {...defaultProps} />, { wrapper: AllTheProviders })

    fireEvent.keyDown(screen.getByPlaceholderText('Write something...'))
    expect(defaultProps.sendIsTyping).toHaveBeenCalledWith(true)
  })

  it('does not run onSubmit when shift-enter is pressed', () => {
    render(<MessageForm {...defaultProps} />, { wrapper: AllTheProviders })

    fireEvent.keyDown(screen.getByPlaceholderText('Write something...'), { key: 'Enter', shiftKey: true })
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('runs onSubmit when enter is pressed', () => {
    render(<MessageForm {...defaultProps} />, { wrapper: AllTheProviders })

    fireEvent.keyDown(screen.getByPlaceholderText('Write something...'), { key: 'Enter' })
    expect(defaultProps.onSubmit).toHaveBeenCalled()
  })

  it('shows loading state when pending', () => {
    render(<MessageForm {...defaultProps} pending={true} />, { wrapper: AllTheProviders })

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
