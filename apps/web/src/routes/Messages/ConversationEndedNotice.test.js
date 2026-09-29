import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import ConversationEndedNotice, { isConversationEnded } from './ConversationEndedNotice'

describe('isConversationEnded', () => {
  const me = { id: '1' }

  it('is true when only the viewer is left in the conversation', () => {
    expect(isConversationEnded({ participants: [{ id: '1' }] }, me)).toBe(true)
    expect(isConversationEnded({ participants: [{ id: 1 }] }, me)).toBe(true)
  })

  it('is false while someone else is still in it', () => {
    expect(isConversationEnded({ participants: [{ id: '1' }, { id: '2' }] }, me)).toBe(false)
  })

  it('is false before the conversation has loaded', () => {
    expect(isConversationEnded(null, me)).toBe(false)
    expect(isConversationEnded({ participants: [] }, me)).toBe(false)
    expect(isConversationEnded({ participants: [{ id: '1' }] }, null)).toBe(false)
  })
})

describe('ConversationEndedNotice', () => {
  it('explains replies will not arrive and links to a new message', () => {
    render(<ConversationEndedNotice />)
    expect(screen.getByTestId('conversation-ended-notice')).toHaveTextContent('conversationEndedNotice')
    expect(screen.getByRole('link', { name: 'Start a new message' })).toHaveAttribute('href', '/messages/new')
  })
})
