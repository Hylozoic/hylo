import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import Message from './Message'

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

  it('renders a header message correctly', () => {
    render(<Message message={defaultMessage} isHeader />)

    expect(screen.getByText('Good Person')).toBeInTheDocument()
    expect(screen.getByText('test message')).toBeInTheDocument()
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.getByText(/1y ago/)).toBeInTheDocument()
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
})
