import React from 'react'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import extractModelsForTest from 'util/testing/extractModelsForTest'
import { DETAIL_COLUMN_ID } from 'util/scrolling'
import PostDetail from './PostDetail'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({
    groupSlug: 'foo',
    postId: '91'
  }),
  useLocation: () => ({
    pathname: '/group/foo/post/91'
  })
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
    // Add a mock element with id=DETAIL_COLUMN_ID to the document
    const detailColumn = document.createElement('div')
    detailColumn.id = DETAIL_COLUMN_ID
    document.body.appendChild(detailColumn)

    mockGraphqlServer.use(
      graphql.query('FetchPost', () => HttpResponse.json({
        data: {
          post
        }
      }))
    )
  })

  it('renders correctly', async () => {
    const group = {
      id: '109',
      slug: 'foo'
    }

    const ormSession = orm.session(orm.getEmptyState())
    extractModelsForTest({
      posts: [post],
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
      expect(screen.getByText('#singing')).toBeInTheDocument()
      expect(screen.getByText('#dancing')).toBeInTheDocument()
    })
  })

  it('shows loading state when post is pending', async () => {
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

    await waitFor(() => {
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    })
  })

  it('shows NotFound when post does not exist', async () => {
    jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group', postId: 'akjhdskjfh' })
    render(
      <PostDetail />,
      { wrapper: AllTheProviders() }
    )

    await waitFor(() => {
      expect(screen.getByText('404 Not Found')).toBeInTheDocument()
    })
  })
})

