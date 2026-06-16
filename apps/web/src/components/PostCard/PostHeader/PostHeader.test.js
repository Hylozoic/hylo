import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PostHeader, { TopicsLine } from './PostHeader'

jest.mock('luxon', () => ({
  __esModule: true,
  default: () => ({
    fromNow: () => 'a few seconds ago',
    format: () => '2024-07-23 16:30'
  })
}))

const routeParams = { groupSlug: 'fooc' }

const buildPost = (overrides = {}) => ({
  id: 1,
  announcement: false,
  creator: {
    name: 'JJ',
    avatarUrl: 'foo.png',
    id: 123,
    tagline: '',
    moderatedGroupMemberships: []
  },
  createdTimestamp: 'a few seconds ago',
  exactCreatedTimestamp: '2024-07-23 16:30',
  type: 'discussion',
  proposalOutcome: null,
  proposalStatus: null,
  endTime: null,
  startTime: null,
  fulfilledAt: null,
  savedAt: null,
  ...overrides
})

const defaultProps = {
  routeParams,
  post: buildPost(),
  group: { id: 1, name: 'FooC', slug: 'fooc' }
}

describe('PostHeader', () => {
  it('renders basic post header', () => {
    render(
      <PostHeader
        {...defaultProps}
      />
    )

    expect(screen.getByText('JJ')).toBeInTheDocument()
    expect(screen.getByText('a few seconds ago')).toBeInTheDocument()
  })

  it('renders post header with type', () => {
    render(
      <PostHeader
        {...defaultProps}
        post={buildPost({ type: 'request' })}
      />
    )

    expect(screen.getByText('JJ')).toBeInTheDocument()
    expect(screen.getByTestId('post-type-Request')).toBeInTheDocument()
  })

  it('renders post header with action buttons', () => {
    render(
      <PostHeader
        {...defaultProps}
        deletePost={() => {}}
        editPost={() => {}}
        duplicatePost={() => {}}
      />
    )

    expect(screen.getByTestId('post-header-more-icon')).toBeInTheDocument()
  })
})

describe('PostHeader with announcement', () => {
  it('renders announcement icon', () => {
    render(
      <PostHeader
        {...defaultProps}
        post={buildPost({ announcement: true })}
      />
    )

    expect(screen.getByTestId('post-header-announcement-icon')).toBeInTheDocument()
  })
})

describe('PostHeader with date range', () => {
  it('renders human readable dates', () => {
    render(
      <PostHeader
        {...defaultProps}
        post={buildPost({
          type: 'request',
          startTime: new Date('2028-11-29'),
          endTime: new Date('2034-11-29')
        })}
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
