import { DateTimeHelpers } from '@hylo/shared'
import React from 'react'
import { formatUserDatePair } from 'util/dateFormat'
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

  it('shows the time in the viewer timezone', () => {
    const startTime = '2026-06-15T19:00:00.000Z'
    const endTime = '2026-06-15T21:00:00.000Z'
    const viewerZone = DateTimeHelpers.getCurrentTimezone()
    const postTimezone = viewerZone === 'Pacific/Auckland' ? 'America/Los_Angeles' : 'Pacific/Auckland'
    const viewerTime = formatUserDatePair({ start: startTime, end: endTime })
    const postTime = formatUserDatePair({ start: startTime, end: endTime, timezone: postTimezone })

    render(
      <ChatPostNotice post={{ ...post, type: 'event', title: 'Potluck', startTime, endTime, timezone: postTimezone }} />
    )

    expect(viewerTime).not.toEqual(postTime)
    expect(screen.getByText(viewerTime)).toBeInTheDocument()
  })

  it('leaves an open post at full strength without a check', () => {
    const { container } = render(<ChatPostNotice post={post} />)
    expect(container.querySelector('.text-green-500')).toBeNull()
    expect(container.firstChild.className).not.toMatch(/opacity-60/)
  })
})
