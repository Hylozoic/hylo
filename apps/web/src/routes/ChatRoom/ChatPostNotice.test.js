import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import ChatPostNotice from './ChatPostNotice'

const post = {
  id: '1',
  type: 'request',
  title: 'Need a ladder',
  creator: { id: '2', name: 'Ada' },
  commentsTotal: 0
}

describe('ChatPostNotice', () => {
  it('shows a check and fades the card when the post is fulfilled', () => {
    const { container } = render(
      <ChatPostNotice post={{ ...post, fulfilledAt: '2026-01-01T00:00:00.000Z' }} />
    )
    expect(screen.getByText('Need a ladder')).toBeInTheDocument()
    expect(container.querySelector('.text-green-500')).toBeTruthy()
    expect(container.firstChild.className).toMatch(/opacity-60/)
  })

  it('leaves an open post at full strength without a check', () => {
    const { container } = render(<ChatPostNotice post={post} />)
    expect(container.querySelector('.text-green-500')).toBeNull()
    expect(container.firstChild.className).not.toMatch(/opacity-60/)
  })
})
