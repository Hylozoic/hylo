import React from 'react'
import { render, screen, fireEvent, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
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
  onFocus: jest.fn(),
  sendIsTyping: jest.fn()
}

describe('MessageForm', () => {
  it('renders the message form with textarea and send button', () => {
    render(<MessageForm {...defaultProps} />)

    expect(screen.getByPlaceholderText('Write something...')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('displays the current message text', () => {
    render(<MessageForm {...defaultProps} />)

    expect(screen.getByDisplayValue('hey you')).toBeInTheDocument()
  })

  it('calls sendIsTyping when typing happens', () => {
    render(<MessageForm {...defaultProps} />)

    fireEvent.keyDown(screen.getByPlaceholderText('Write something...'))
    expect(defaultProps.sendIsTyping).toHaveBeenCalledWith(true)
  })

  it('does not run onSubmit when shift-enter is pressed', () => {
    render(<MessageForm {...defaultProps} />)

    fireEvent.keyDown(screen.getByPlaceholderText('Write something...'), { key: 'Enter', shiftKey: true })
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('runs onSubmit when button is pressed', () => {
    render(<MessageForm {...defaultProps} />)

    fireEvent.click(screen.getByTestId('send-button'))
    expect(defaultProps.onSubmit).toHaveBeenCalled()
  })

  it('runs onSubmit when enter is pressed', () => {
    render(<MessageForm {...defaultProps} />)

    fireEvent.change(screen.getByPlaceholderText('Write something...'), { target: { value: 'hey you' } })
    fireEvent.keyDown(screen.getByPlaceholderText('Write something...'), { key: 'Enter' })
    expect(defaultProps.onSubmit).toHaveBeenCalled()
  })

  it('shows loading state when pending', () => {
    render(<MessageForm {...defaultProps} pending />)

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })
})

