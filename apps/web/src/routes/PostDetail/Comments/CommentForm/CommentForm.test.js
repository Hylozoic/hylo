import React from 'react'
import orm from 'store/models'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import CommentForm from './CommentForm'
import Me from 'store/models/Me'

const minDefaultProps = {
  postId: 'new',
  createComment: jest.fn()
}

function currentUserTestProviders () {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Me.create({
    id: '20',
    name: 'Jen Smith',
    avatarUrl: 'foo.png'
  })
  const reduxState = { orm: session.state }
  return AllTheProviders(reduxState)
}

describe('CommentForm', () => {
  it('renders correctly with current user', () => {
    render(
      <CommentForm {...minDefaultProps} />,
      { wrapper: currentUserTestProviders() }
    )

    // expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument()
    expect(screen.getByRole('img').getAttribute('style')).toContain('background-image: url(foo.png)')
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
    expect(screen.getByTestId('upload-button')).toBeInTheDocument()
  })

  it('renders correctly without current user', () => {
    render(
      <CommentForm {...minDefaultProps} />
    )

    // expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument()
    expect(screen.getByTestId('icon-Person')).toBeInTheDocument()
    expect(screen.getByText('Sign up to reply', { selector: 'a' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('upload-button')).not.toBeInTheDocument()
  })

  it('uses custom placeholder text when provided', () => {
    const customPlaceholder = 'Write your thoughts...'
    render(
      <CommentForm {...minDefaultProps} placeholder={customPlaceholder} />,
      { wrapper: currentUserTestProviders() }
    )

    expect(screen.getByText('', { selector: `p[data-placeholder="${customPlaceholder}"]` })).toBeInTheDocument()
  })
})
