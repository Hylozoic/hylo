import React from 'react'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import CommentForm from './CommentForm'

function providersWithUser (user = { id: '1', name: 'Jen Smith', avatarUrl: 'foo.png' }) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  if (user) ormSession.Me.create(user)
  return AllTheProviders({ orm: ormSession.state })
}

describe('CommentForm', () => {
  it('renders correctly with current user', () => {
    render(
      <CommentForm postId='new' createComment={jest.fn()} />,
      { wrapper: providersWithUser() }
    )

    expect(screen.getByRole('img').getAttribute('style')).toContain('background-image: url(foo.png)')
    expect(screen.getByTestId('upload-button')).toBeInTheDocument()
  })

  it('renders correctly without current user', () => {
    render(
      <CommentForm postId='new' createComment={jest.fn()} />,
      { wrapper: providersWithUser(null) }
    )

    expect(screen.getByTestId('icon-Person')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign up to reply' })).toBeInTheDocument()
    expect(screen.queryByTestId('upload-button')).not.toBeInTheDocument()
  })
})
