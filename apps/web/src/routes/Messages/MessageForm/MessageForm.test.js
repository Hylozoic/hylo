import React from 'react'
import { render, screen, fireEvent, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import { UPLOAD_ATTACHMENT } from 'store/constants'
import MessageForm from './MessageForm'

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
    expect(screen.getByTestId('send-button')).toBeInTheDocument()
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
    expect(defaultProps.onSubmit).toHaveBeenCalledWith({
      text: 'hey you',
      attachments: []
    })
  })

  it('runs onSubmit when enter is pressed', () => {
    render(<MessageForm {...defaultProps} />)

    fireEvent.change(screen.getByPlaceholderText('Write something...'), { target: { value: 'hey you' } })
    fireEvent.keyDown(screen.getByPlaceholderText('Write something...'), { key: 'Enter' })
    expect(defaultProps.onSubmit).toHaveBeenCalledWith({
      text: 'hey you',
      attachments: []
    })
  })

  it('shows loading state when pending', () => {
    render(<MessageForm {...defaultProps} pending />)

    expect(screen.getByText(/Sending/i)).toBeInTheDocument()
    expect(screen.queryByTestId('send-button')).not.toBeInTheDocument()
  })

  it('replaces the send button with a spinner while an attachment is uploading', () => {
    render(
      <MessageForm {...defaultProps} />,
      {},
      AllTheProviders({
        pending: {
          [UPLOAD_ATTACHMENT]: {
            type: 'comment',
            id: 'new',
            attachmentType: 'image'
          }
        }
      })
    )

    expect(screen.getByTestId('message-form-spinner')).toBeInTheDocument()
    expect(screen.queryByTestId('send-button')).not.toBeInTheDocument()
  })

  it('does not submit while an attachment is uploading', () => {
    const onSubmit = jest.fn()
    render(
      <MessageForm {...defaultProps} onSubmit={onSubmit} />,
      {},
      AllTheProviders({
        pending: {
          [UPLOAD_ATTACHMENT]: {
            type: 'comment',
            id: 'new',
            attachmentType: 'file'
          }
        }
      })
    )

    fireEvent.keyDown(screen.getByPlaceholderText('Write something...'), { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
