import React from 'react'
import { render, screen, fireEvent, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import Message from './Message'
import updateComment from 'store/actions/updateComment'

jest.mock('store/actions/updateComment', () => ({
  __esModule: true,
  default: jest.fn(() => ({ type: 'UPDATE_COMMENT' }))
}))

function testProviders (meId = '1') {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: meId })
  const reduxState = { orm: ormSession.state, pending: {} }
  return AllTheProviders(reduxState)
}

describe('Message', () => {
  const defaultMessage = {
    id: '1',
    text: 'test message',
    createdAt: '2023-04-15T12:00:00Z',
    creator: {
      id: '1',
      name: 'Good Person',
      avatarUrl: 'http://avatar.com/i.png'
    }
  }

  beforeEach(() => {
    updateComment.mockClear()
  })

  it('renders a header message correctly', () => {
    render(<Message message={defaultMessage} isHeader />, { wrapper: testProviders() })

    expect(screen.getByText('Good Person')).toBeInTheDocument()
    expect(screen.getByText('test message')).toBeInTheDocument()
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.getByText(/ago/i)).toBeInTheDocument()
  })

  it('renders a non-header message correctly', () => {
    render(<Message message={defaultMessage} />)

    expect(screen.queryByText('Good Person')).not.toBeInTheDocument()
    expect(screen.getByText('test message')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('displays "sending..." when message is in optimistic state', () => {
    const optimisticMessage = {
      ...defaultMessage,
      id: 'messageThread12_1'
    }
    render(<Message message={optimisticMessage} isHeader />)

    expect(screen.getAllByText('sending...')).toHaveLength(2)
    expect(screen.queryByText(/Apr 15, 2023/)).not.toBeInTheDocument()
  })

  it('shows edited timestamp when editedAt is set', () => {
    const editedMessage = {
      ...defaultMessage,
      editedAt: '2023-04-16T12:00:00Z'
    }
    render(<Message message={editedMessage} isHeader />, { wrapper: testProviders() })

    expect(screen.getByText(/edited/i)).toBeInTheDocument()
  })

  it('allows the creator to edit a message', () => {
    render(<Message message={defaultMessage} isHeader />, { wrapper: testProviders() })

    fireEvent.click(screen.getByLabelText('Edit'))
    const editor = screen.getByRole('textbox')
    expect(editor).toBeInTheDocument()
    expect(editor).toHaveTextContent('test message')
    fireEvent.click(screen.getByLabelText('Save'))

    expect(updateComment).toHaveBeenCalledWith('1', '<p>test message</p>')
  })

  it('parses HTML message content in the editor instead of showing tags', () => {
    const htmlMessage = {
      ...defaultMessage,
      text: '<p>hello world</p>'
    }
    render(<Message message={htmlMessage} isHeader />, { wrapper: testProviders() })

    fireEvent.click(screen.getByLabelText('Edit'))
    const editor = screen.getByRole('textbox')
    expect(editor).toHaveTextContent('hello world')
    expect(editor.textContent).not.toContain('<p>')
  })
})
