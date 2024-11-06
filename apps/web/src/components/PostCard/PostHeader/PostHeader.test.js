import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PostHeader, { TopicsLine } from './PostHeader'
import { RESP_ADMINISTRATION } from 'store/constants'

jest.mock('moment-timezone', () => ({
  __esModule: true,
  default: () => ({
    fromNow: () => 'a few seconds ago',
    format: () => '2024-07-23 16:30'
  })
}))

const mockCreator = {
  name: 'JJ',
  avatarUrl: 'foo.png',
  id: 123,
  moderatedGroupMemberships: []
}

const mockGroups = [
  { name: 'FooC', slug: 'fooc' },
  { name: 'BarC', slug: 'barc' }
]

const mockContext = {
  label: 'some context',
  url: '/foo/bar'
}

describe('PostHeader', () => {
  it('renders basic post header', () => {
    render(
      <PostHeader
        groups={mockGroups}
        creator={mockCreator}
        roles={[{ id: 1, title: 'Coordinator', common: true, responsibilities: [RESP_ADMINISTRATION] }]}
      />
    )

    expect(screen.getByText('JJ')).toBeInTheDocument()
    expect(screen.getByText('a few seconds ago')).toBeInTheDocument()
    expect(screen.getByText('Coordinator')).toBeInTheDocument()
  })

  it('renders post header with context and type', () => {
    render(
      <PostHeader
        groups={mockGroups}
        creator={mockCreator}
        context={mockContext}
        type='request'
        roles={[]}
      />
    )

    expect(screen.getByText('JJ')).toBeInTheDocument()
    expect(screen.getByText('Request')).toBeInTheDocument()
  })

  it('renders post header with action buttons', () => {
    render(
      <PostHeader
        groups={mockGroups}
        creator={mockCreator}
        context={mockContext}
        type='request'
        deletePost={() => {}}
        editPost={() => {}}
        duplicatePost={() => {}}
        roles={[]}
      />
    )

    expect(screen.getByLabelText('More')).toBeInTheDocument()
  })
})

describe('PostHeader with announcement', () => {
  it('renders announcement icon', () => {
    render(
      <PostHeader
        groups={mockGroups}
        creator={mockCreator}
        announcement
        roles={[]}
      />
    )

    expect(screen.getByLabelText('Announcement')).toBeInTheDocument()
  })
})

describe('PostHeader with date range', () => {
  it('renders human readable dates', () => {
    render(
      <PostHeader
        type='request'
        groups={mockGroups}
        creator={mockCreator}
        context={mockContext}
        startTime='2024-11-29'
        endTime='2029-11-29'
        roles={[]}
      />
    )

    expect(screen.getByText(/Starts:/)).toBeInTheDocument()
    expect(screen.getByText(/Ends:/)).toBeInTheDocument()
  })
})

describe('TopicsLine', () => {
  it('renders topics', () => {
    render(
      <TopicsLine
        topics={[{ name: 'one' }, { name: 'two' }]}
        slug='hay'
        newLine
      />
    )

    expect(screen.getByText('#one')).toBeInTheDocument()
    expect(screen.getByText('#two')).toBeInTheDocument()
  })
})
