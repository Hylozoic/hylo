import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import ChatActivityCard, { chatUrlForActivityPost } from './ChatActivityCard'

it('renders chat activity header, timestamp, messages, and a link to the group chat', () => {
  const post = {
    id: 'notice-1',
    type: 'chat_activity',
    createdTimestamp: '2h ago',
    exactCreatedTimestamp: '8/6/2026 5:55 PM PDT',
    noticeData: { postCount: 3, recentPostIds: ['9', '8', '7'] },
    groups: [{ id: '1', name: 'Buy Nothing', slug: 'buy-nothing', type: null }],
    noticePosts: [
      { id: '9', details: '<p>Claimed! Heading over this afternoon</p>', creator: { id: '2', name: 'Tran' } },
      { id: '8', details: '<p>Giving away boxes</p>', creator: { id: '3', name: 'Marisol' } },
      { id: '7', details: '<p>Anyone need tape?</p>', creator: { id: '4', name: 'Lee' } }
    ]
  }

  render(<ChatActivityCard post={post} />)

  expect(screen.getByTestId('chat-activity-card')).toBeInTheDocument()
  expect(screen.getByText('CHAT ACTIVITY')).toBeInTheDocument()
  expect(screen.getByText('Buy Nothing')).toBeInTheDocument()
  expect(screen.getByText('2h ago')).toBeInTheDocument()
  expect(screen.getByText('Tran')).toBeInTheDocument()
  expect(screen.getByText(/Claimed! Heading over this afternoon/)).toBeInTheDocument()
  expect(screen.getByText('Marisol')).toBeInTheDocument()
  const openLink = screen.getByRole('link', { name: /^Open$/ })
  expect(openLink).toHaveAttribute('href', '/groups/buy-nothing/chat?postId=9')
})

it('builds a space chat URL from the parent slug', () => {
  const url = chatUrlForActivityPost({
    groups: [{
      id: '2',
      name: 'Buy Nothing',
      slug: 'acme-buy-nothing',
      type: 'space',
      parentId: '1'
    }],
    noticePosts: [{ id: '44' }]
  }, 'acme')
  expect(url).toEqual('/groups/acme/spaces/buy-nothing/chat?postId=44')
})
