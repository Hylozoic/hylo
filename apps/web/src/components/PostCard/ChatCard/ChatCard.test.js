import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import ChatCard from './index'
import { Provider } from 'react-redux'
import { createStore } from 'redux'

describe('ChatCard', () => {
  const defaultProps = {
    post: {
      id: 1,
      title: 'hello there',
      details: 'the details',
      creator: {
        name: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg'
      },
      topics: [{ name: 'general' }],
      groups: [{ name: 'Test Group' }],
      createdAt: '2023-04-20T12:00:00Z',
      attachments: [
        {
          type: 'file',
          url: 'https://www.hylo.com/awitp.pdf'
        },
        {
          type: 'file',
          url: 'http://www.google.com/lalala.zip'
        }
      ]
    },
    showDetails: jest.fn(),
    slug: 'foomunity',
    expanded: true,
    highlightProps: { term: 'foo' }
  }

  it('renders the ChatCard with correct content', () => {
    render(
      <Provider store={createStore(() => {})}>
        <ChatCard {...defaultProps} />
      </Provider>
    )

    // Check for creator's name
    expect(screen.getByText('John Doe')).toBeInTheDocument()

    // Check for topic
    expect(screen.getByText('#general')).toBeInTheDocument()

    // Check for group name (not visible when slug is provided)
    expect(screen.queryByText('Test Group')).not.toBeInTheDocument()

    // Check for post details
    expect(screen.getByText('the details')).toBeInTheDocument()

    // Check for file attachments
    expect(screen.getByText('awitp.pdf')).toBeInTheDocument()
    expect(screen.getByText('lalala.zip')).toBeInTheDocument()
  })

  it('calls showDetails when clicked', () => {
    render(
      <Provider store={createStore(() => {})}>
        <ChatCard {...defaultProps} />
      </Provider>
    )

    screen.getByText('the details').click()
    expect(defaultProps.showDetails).toHaveBeenCalledWith(defaultProps.post.id)
  })

  it('displays group name when slug is not provided', () => {
    render(
      <Provider store={createStore(() => {})}>
        <ChatCard {...defaultProps} slug={null} />
      </Provider>
    )

    expect(screen.getByText('Test Group')).toBeInTheDocument()
  })
})
