import React from 'react'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import ModerationListItem from './ModerationListItem'

function providers () {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Me.create({ id: '1', name: 'Moderator' })
  return AllTheProviders({ orm: session.state })
}

const baseAction = {
  id: '5',
  groupId: '3',
  status: 'active',
  createdAt: '2026-09-01T10:00:00.000Z',
  text: 'Please look at this',
  anonymous: false,
  reporter: { id: '2', name: 'Reporter', avatarUrl: '' },
  agreements: [],
  platformAgreements: [],
  post: { id: '10', title: 'A post', details: '<p>Post body</p>', type: 'discussion', creator: { id: '4', name: 'Author', avatarUrl: '' }, groups: [{ id: '3' }] }
}

describe('ModerationListItem', () => {
  it('shows the reported comment above its post for a comment report', () => {
    const action = {
      ...baseAction,
      commentId: '77',
      comment: { id: '77', text: '<p>The rude reply</p>', creator: { id: '8', name: 'Commenter', avatarUrl: '' } }
    }
    render(<ModerationListItem moderationAction={action} group={{ id: '3', slug: 'g' }} />, { wrapper: providers() })
    expect(screen.getByTestId('moderation-reported-comment')).toBeInTheDocument()
    expect(screen.getByText('The rude reply')).toBeInTheDocument()
    expect(screen.getByText('On this post')).toBeInTheDocument()
  })

  it('shows only the post for a post report', () => {
    render(<ModerationListItem moderationAction={baseAction} group={{ id: '3', slug: 'g' }} />, { wrapper: providers() })
    expect(screen.queryByTestId('moderation-reported-comment')).not.toBeInTheDocument()
    expect(screen.getByText('Reported content')).toBeInTheDocument()
  })
})
