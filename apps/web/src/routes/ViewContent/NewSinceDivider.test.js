import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import NewSinceDivider, { newSinceDividerIndex } from './NewSinceDivider'

const baseline = new Date('2026-09-10T00:00:00Z')
const post = (id, createdAt, updatedAt = createdAt) => ({ id, createdAt, updatedAt })

describe('newSinceDividerIndex', () => {
  const posts = [
    post('1', '2026-09-12T00:00:00Z'),
    post('2', '2026-09-11T00:00:00Z'),
    post('3', '2026-09-09T00:00:00Z'),
    post('4', '2026-09-08T00:00:00Z')
  ]

  it('goes before the first post from before the last visit', () => {
    expect(newSinceDividerIndex(posts, baseline, 'created')).toBe(2)
  })

  it('uses the time the feed is sorted by', () => {
    const updated = [
      post('1', '2026-09-01T00:00:00Z', '2026-09-12T00:00:00Z'),
      post('2', '2026-09-02T00:00:00Z', '2026-09-05T00:00:00Z')
    ]
    expect(newSinceDividerIndex(updated, baseline, 'updated')).toBe(1)
    expect(newSinceDividerIndex(updated, baseline, 'created')).toBeNull()
  })

  it('shows nothing when nothing is new', () => {
    expect(newSinceDividerIndex(posts.slice(2), baseline, 'created')).toBeNull()
  })

  it('shows nothing until an older post has loaded', () => {
    expect(newSinceDividerIndex(posts.slice(0, 2), baseline, 'created')).toBeNull()
  })

  it('shows nothing without a last visit or for other sorts', () => {
    expect(newSinceDividerIndex(posts, null, 'created')).toBeNull()
    expect(newSinceDividerIndex(posts, baseline, 'votes')).toBeNull()
  })

  it('skips rows without a time, such as chat activity', () => {
    const withActivity = [posts[0], { id: 'chat', type: 'chat_activity' }, posts[2]]
    expect(newSinceDividerIndex(withActivity, baseline, 'created')).toBe(2)
  })
})

describe('NewSinceDivider', () => {
  it('labels the boundary', () => {
    render(<NewSinceDivider />)
    expect(screen.getByRole('separator', { name: 'New since your last visit' })).toBeInTheDocument()
  })
})
