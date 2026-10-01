import React from 'react'
import { toast } from 'sonner'
import { act, AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import { graphql, HttpResponse, delay } from 'msw'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import extractModelsForTest from 'util/testing/extractModelsForTest'
import { DETAIL_COLUMN_ID } from 'util/scrolling'
import PostDetail from './PostDetail'

const mockNavigate = jest.fn()
let mockSearch = ''

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({
    groupSlug: 'foo',
    postId: '91'
  }),
  useLocation: () => ({
    pathname: '/group/foo/post/91',
    search: mockSearch
  }),
  useNavigate: () => mockNavigate
}))

jest.mock('sonner', () => ({
  ...jest.requireActual('sonner'),
  toast: Object.assign(jest.fn(), { error: jest.fn() })
}))

const post = {
  id: '91',
  creator: {
    id: '1',
    name: 'John Doe'
  },
  title: 'Test Post',
  details: 'the body of the post',
  attachments: [],
  imageUrl: 'foo.jpg',
  topics: [{ id: '1', name: 'singing' }, { id: '2', name: 'dancing' }],
  peopleReactedTotal: 7,
  members: [],
  groups: [{ id: '109', slug: 'foo' }],
  type: 'default'
}

describe('PostDetail', () => {
  beforeEach(() => {
    if (!document.getElementById(DETAIL_COLUMN_ID)) {
      const detailColumn = document.createElement('div')
      detailColumn.id = DETAIL_COLUMN_ID
      document.body.appendChild(detailColumn)
    }
  })

  it('renders correctly', async () => {
    mockGraphqlServer.use(
      graphql.query('FetchPost', () => HttpResponse.json({
        data: { post }
      }))
    )

    const group = {
      id: '109',
      slug: 'foo'
    }

    const ormSession = orm.session(orm.getEmptyState())
    extractModelsForTest({
      posts: [post]
    }, 'Post', ormSession)
    extractModelsForTest({
      groups: [group]
    }, 'Group', ormSession)

    const reduxState = {
      orm: ormSession.state,
      pending: {}
    }

    render(
      <PostDetail />,
      { wrapper: AllTheProviders(reduxState) }
    )

    await waitFor(() => {
      expect(screen.getByText('Test Post')).toBeInTheDocument()
      expect(screen.getByText('the body of the post')).toBeInTheDocument()
      expect(screen.getByTestId('post-detail-close')).toBeInTheDocument()
    })
  })

  describe('opened from an email unfollow link', () => {
    let unfollowedPostIds, followedPostIds

    const mockFollowMutations = ({ unfollowFails = false, followFails = false } = {}) => {
      mockGraphqlServer.use(
        graphql.query('FetchPost', () => HttpResponse.json({
          data: { post }
        })),
        graphql.mutation('UnfollowPost', ({ variables }) => {
          unfollowedPostIds.push(variables.postId)
          if (unfollowFails) return HttpResponse.json({ errors: [{ message: 'Post not found' }] })
          return HttpResponse.json({ data: { unfollowPost: { id: '91', isFollowing: false } } })
        }),
        graphql.mutation('FollowPost', ({ variables }) => {
          followedPostIds.push(variables.postId)
          if (followFails) return HttpResponse.json({ errors: [{ message: 'Post not found' }] })
          return HttpResponse.json({ data: { followPost: { id: '91', isFollowing: true } } })
        })
      )
    }

    const renderPostDetail = () => {
      const ormSession = orm.session(orm.getEmptyState())
      ormSession.Me.create({ id: '1', name: 'Me' })
      extractModelsForTest({
        posts: [post]
      }, 'Post', ormSession)
      extractModelsForTest({
        groups: [{ id: '109', slug: 'foo' }]
      }, 'Group', ormSession)

      render(
        <PostDetail />,
        { wrapper: AllTheProviders({ orm: ormSession.state, pending: {} }) }
      )
    }

    const clickUndo = async () => {
      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(
          "You won't get notifications for new comments on this post",
          expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) })
        )
      })
      const [, { action: undo }] = toast.mock.calls[0]
      await act(async () => { undo.onClick() })
    }

    beforeEach(() => {
      mockSearch = '?action=unfollow&ctt=post_email'
      unfollowedPostIds = []
      followedPostIds = []
      toast.mockClear()
      toast.error.mockClear()
      mockNavigate.mockClear()
    })

    afterEach(() => {
      mockSearch = ''
    })

    it('unfollows the post once, drops the param, and Undo follows it again', async () => {
      mockFollowMutations()
      renderPostDetail()

      await clickUndo()
      expect(unfollowedPostIds).toEqual(['91'])
      expect(mockNavigate).toHaveBeenCalledWith(
        { pathname: '/group/foo/post/91', search: '?ctt=post_email' },
        { replace: true, state: undefined }
      )
      await waitFor(() => {
        expect(followedPostIds).toEqual(['91'])
      })
      expect(unfollowedPostIds).toEqual(['91'])
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('says so when the unfollow fails', async () => {
      mockFollowMutations({ unfollowFails: true })
      renderPostDetail()

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Couldn't turn off notifications for this post")
      })
      expect(toast).not.toHaveBeenCalled()
    })

    it('says so when Undo fails', async () => {
      mockFollowMutations({ followFails: true })
      renderPostDetail()

      await clickUndo()
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Couldn't turn notifications for this post back on")
      })
      expect(followedPostIds).toEqual(['91'])
    })
  })

  it('shows loading state when post is pending', () => {
    mockGraphqlServer.use(
      graphql.query('FetchPost', async () => {
        await delay('infinite')
        return HttpResponse.json({ data: { post: null } })
      })
    )

    const ormSession = orm.session(orm.getEmptyState())
    const reduxState = {
      orm: ormSession.state,
      pending: {
        FETCH_POST: true
      }
    }

    render(
      <PostDetail />,
      { wrapper: AllTheProviders(reduxState) }
    )

    expect(screen.getByLabelText('Loading post')).toBeInTheDocument()
  })

  it('shows NotFound when post does not exist', async () => {
    mockGraphqlServer.use(
      graphql.query('FetchPost', () => HttpResponse.json({
        data: { post: null }
      }))
    )

    jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group', postId: 'akjhdskjfh' })
    render(
      <PostDetail />,
      { wrapper: AllTheProviders() }
    )

    await waitFor(() => {
      expect(screen.getByText('404 Not Found')).toBeInTheDocument()
    })
  })

  describe('when the post cannot be loaded', () => {
    beforeEach(() => {
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group', postId: '404040' })
    })

    it('offers to try again after a server error, and shows the post once it loads', async () => {
      let attempts = 0
      mockGraphqlServer.use(
        graphql.query('FetchPost', () => {
          attempts += 1
          if (attempts === 1) return new HttpResponse('Server error', { status: 503 })
          return HttpResponse.json({ data: { post: { ...post, id: '404040', title: 'Back again' } } })
        })
      )
      render(<PostDetail />, { wrapper: AllTheProviders() })

      await screen.findByTestId('load-failed')
      expect(screen.queryByText('404 Not Found')).not.toBeInTheDocument()

      await act(async () => { screen.getByRole('button', { name: 'Try Again' }).click() })

      await screen.findAllByText('Back again')
      expect(attempts).toBeGreaterThanOrEqual(2)
      expect(screen.queryByTestId('load-failed')).not.toBeInTheDocument()
    })

    it('still says not found when the post is missing or hidden', async () => {
      mockGraphqlServer.use(graphql.query('FetchPost', () => HttpResponse.json({ data: { post: null } })))
      render(<PostDetail />, { wrapper: AllTheProviders() })

      await screen.findByText('404 Not Found')
      expect(screen.queryByTestId('load-failed')).not.toBeInTheDocument()
    })
  })
})
