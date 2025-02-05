import React from 'react'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import CommentForm from './CommentForm'
import Me from 'store/models/Me'

const minDefaultProps = {
  postId: 'new',
  createComment: jest.fn(),
  currentUser: new Me({
    name: 'Jen Smith',
    avatarUrl: 'foo.png'
  }),
  sendIsTyping: jest.fn(),
  addAttachment: jest.fn(),
  clearAttachments: jest.fn(),
  attachments: []
}

describe('CommentForm', () => {
  it('renders correctly with current user', () => {
    render(
      <CommentForm {...minDefaultProps} />
    )

    // expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument()
    expect(screen.getByRole('img').getAttribute('style')).toContain('background-image: url(foo.png)')
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
    expect(screen.getByTestId('upload-button')).toBeInTheDocument()
  })

  it('renders correctly without current user', () => {
    render(
      <CommentForm {...minDefaultProps} currentUser={null} />
    )

    // expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument()
    expect(screen.getByTestId('icon-Person')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign up to reply' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('upload-button')).not.toBeInTheDocument()
  })

  it.skip('uses custom placeholder when provided', () => {
    render(
      <CommentForm {...minDefaultProps} placeholder='Custom placeholder' />
    )

    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument()
  })
})
