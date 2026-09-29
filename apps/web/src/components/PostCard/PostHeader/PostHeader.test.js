import React from 'react'
import { act, fireEvent } from '@testing-library/react'
import { AnalyticsEvents } from '@hylo/shared'
import orm from 'store/models'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import { updateProposalOutcome } from './PostHeader.store'
import PostHeader, { TopicsLine } from './PostHeader'

jest.mock('./PostHeader.store', () => ({
  ...jest.requireActual('./PostHeader.store'),
  updateProposalOutcome: jest.fn((postId, proposalOutcome) => ({ type: 'TEST_UPDATE_PROPOSAL_OUTCOME', meta: { postId, proposalOutcome } }))
}))

jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn(() => ({ type: 'TEST_TRACK_ANALYTICS_EVENT' })))

jest.mock('store/actions/followPost', () => ({
  followPost: jest.fn(postId => ({ type: 'TEST_FOLLOW_POST', meta: { postId } })),
  unfollowPost: jest.fn(postId => ({ type: 'TEST_UNFOLLOW_POST', meta: { postId } }))
}))

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

    expect(screen.getByText('#one')).toHaveAttribute('href', '/search?t=%23one&groupSlug=hay')
    expect(screen.getByText('#two')).toHaveAttribute('href', '/search?t=%23two&groupSlug=hay')
  })
})

function providersWithCreatorSignedIn () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: 123, name: 'JJ' })
  return AllTheProviders({ orm: ormSession.state })
}

describe('PostHeader proposal outcome', () => {
  const completedProposal = buildPost({ type: 'proposal', proposalStatus: 'completed', fulfilledAt: null })

  beforeEach(() => {
    updateProposalOutcome.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('lets the author record an outcome once voting has completed on its own', () => {
    render(<PostHeader {...defaultProps} post={completedProposal} expanded />, { wrapper: providersWithCreatorSignedIn() })
    expect(screen.getByPlaceholderText('Summarize the outcome')).toBeInTheDocument()
  })

  it('does not offer the outcome while voting is still open', () => {
    render(
      <PostHeader {...defaultProps} post={buildPost({ type: 'proposal', proposalStatus: 'voting' })} expanded />,
      { wrapper: providersWithCreatorSignedIn() }
    )
    expect(screen.queryByPlaceholderText('Summarize the outcome')).not.toBeInTheDocument()
  })

  it('saves the outcome once typing pauses rather than on every keystroke', () => {
    jest.useFakeTimers()
    render(<PostHeader {...defaultProps} post={completedProposal} expanded />, { wrapper: providersWithCreatorSignedIn() })
    const input = screen.getByPlaceholderText('Summarize the outcome')

    fireEvent.change(input, { target: { value: 'A' } })
    fireEvent.change(input, { target: { value: 'Adopted' } })
    expect(input).toHaveValue('Adopted')
    expect(updateProposalOutcome).not.toHaveBeenCalled()

    act(() => { jest.advanceTimersByTime(600) })
    expect(updateProposalOutcome).toHaveBeenCalledTimes(1)
    expect(updateProposalOutcome).toHaveBeenCalledWith(1, 'Adopted')
  })

  it('saves straight away when the field loses focus', () => {
    render(<PostHeader {...defaultProps} post={completedProposal} expanded />, { wrapper: providersWithCreatorSignedIn() })
    const input = screen.getByPlaceholderText('Summarize the outcome')

    fireEvent.change(input, { target: { value: 'Adopted with changes' } })
    fireEvent.blur(input)
    expect(updateProposalOutcome).toHaveBeenCalledWith(1, 'Adopted with changes')
  })
})

describe('PostHeader copy link', () => {
  it('records that the post was shared', () => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn() } })
    trackAnalyticsEvent.mockClear()
    render(<PostHeader {...defaultProps} />)

    fireEvent.click(screen.getByTestId('post-header-more-icon'))
    fireEvent.click(screen.getByText('Copy Link'))

    expect(navigator.clipboard.writeText).toHaveBeenCalled()
    expect(trackAnalyticsEvent).toHaveBeenCalledWith(AnalyticsEvents.POST_SHARED, expect.objectContaining({ postId: 1, source: 'copy_link' }))
  })
})

describe('PostHeader follow control', () => {
  const { followPost, unfollowPost } = require('store/actions/followPost')

  function signedInAs (id = '555') {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Me.create({ id, name: 'Reader' })
    return AllTheProviders({ orm: ormSession.state })
  }

  function openMenu () {
    fireEvent.click(screen.getByTestId('post-header-more-icon'))
  }

  beforeEach(() => {
    followPost.mockClear()
    unfollowPost.mockClear()
  })

  it('offers to unfollow a post the reader follows', () => {
    render(<PostHeader {...defaultProps} post={buildPost({ isFollowing: true })} />, { wrapper: signedInAs() })
    openMenu()

    fireEvent.click(screen.getByText('Unfollow post'))

    expect(unfollowPost).toHaveBeenCalledWith(1)
    expect(followPost).not.toHaveBeenCalled()
  })

  it('offers to follow a post the reader does not follow', () => {
    render(<PostHeader {...defaultProps} post={buildPost({ isFollowing: false })} />, { wrapper: signedInAs() })
    openMenu()

    fireEvent.click(screen.getByText('Follow post'))

    expect(followPost).toHaveBeenCalledWith(1)
  })

  it('is not offered to signed-out readers, on message threads, or before the state is known', () => {
    const { unmount } = render(<PostHeader {...defaultProps} post={buildPost({ isFollowing: true })} />)
    openMenu()
    expect(screen.queryByText('Unfollow post')).not.toBeInTheDocument()
    unmount()

    const thread = render(<PostHeader {...defaultProps} post={buildPost({ type: 'thread', isFollowing: true })} />, { wrapper: signedInAs() })
    openMenu()
    expect(screen.queryByText('Unfollow post')).not.toBeInTheDocument()
    thread.unmount()

    render(<PostHeader {...defaultProps} post={buildPost()} />, { wrapper: signedInAs() })
    openMenu()
    expect(screen.queryByText('Follow post')).not.toBeInTheDocument()
    expect(screen.queryByText('Unfollow post')).not.toBeInTheDocument()
  })
})
