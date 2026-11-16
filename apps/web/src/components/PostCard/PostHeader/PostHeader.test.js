import React from 'react'
import userEvent from '@testing-library/user-event'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
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

  describe('follow menu', () => {
    const renderMenu = (post) => {
      const ormSession = orm.mutableSession(orm.getEmptyState())
      ormSession.Me.create({ id: '1', name: 'Ada' })
      render(
        <PostHeader {...defaultProps} post={post} />,
        { wrapper: AllTheProviders({ orm: ormSession.state }) }
      )
    }

    it('offers Follow Post when the viewer is not following', async () => {
      renderMenu(buildPost({ following: false }))
      await userEvent.click(screen.getByTestId('post-header-more-icon'))
      expect(screen.getByText('Follow Post')).toBeInTheDocument()
    })

    it('offers Unfollow Post when the viewer is following', async () => {
      renderMenu(buildPost({ following: true }))
      await userEvent.click(screen.getByTestId('post-header-more-icon'))
      expect(screen.getByText('Unfollow Post')).toBeInTheDocument()
    })
  })
})

describe('PostHeader with announcement', () => {
  describe('when someone other than the creator views a completed proposal (#1727)', () => {
    const proposal = overrides => buildPost({ type: 'proposal', fulfilledAt: '2024-07-23T16:30:00Z', ...overrides })

    it('lets them edit the outcome when the server says they can edit', () => {
      render(<PostHeader {...defaultProps} expanded post={proposal({ canEdit: true })} />)
      expect(screen.getByPlaceholderText('Summarize the outcome')).toBeInTheDocument()
    })

    it('does not otherwise', () => {
      render(<PostHeader {...defaultProps} expanded post={proposal({ canEdit: false })} />)
      expect(screen.queryByPlaceholderText('Summarize the outcome')).not.toBeInTheDocument()
    })
  })

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

    expect(screen.getByText('#one')).toHaveAttribute('href', '/search?t=%23one&groupSlug=hay')
    expect(screen.getByText('#two')).toHaveAttribute('href', '/search?t=%23two&groupSlug=hay')
  })
})
