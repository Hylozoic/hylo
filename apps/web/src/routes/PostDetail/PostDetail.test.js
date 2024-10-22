import React from 'react'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import extractModelsForTest from 'util/testing/extractModelsForTest'
import PostDetail from './PostDetail'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({
    slug: 'foo',
    postId: '91'
  }),
  useLocation: () => ({
    pathname: '/c/foo/post/91'
  })
}))

describe('PostDetail', () => {
  it('renders correctly', () => {
    const post = {
      id: '91',
      title: 'Test Post',
      details: 'the body of the post',
      attachments: [],
      imageUrl: 'foo.jpg',
      tags: ['singing', 'dancing'],
      peopleReactedTotal: 7,
      members: [],
      groups: [{ id: '109', slug: 'foo' }],
      type: 'default'
    }

    const group = {
      id: '109',
      slug: 'foo'
    }

    const ormSession = orm.session(orm.getEmptyState())
    extractModelsForTest({
      posts: [post],
      groups: [group]
    }, ['Post', 'Group'], ormSession)

    const reduxState = {
      orm: ormSession.state,
      pending: {}
    }

    render(
      <PostDetail />,
      { wrapper: AllTheProviders(reduxState) }
    )

    expect(screen.getByText('Test Post')).toBeInTheDocument()
    expect(screen.getByText('the body of the post')).toBeInTheDocument()
    expect(screen.getByText('singing')).toBeInTheDocument()
    expect(screen.getByText('dancing')).toBeInTheDocument()
  })

  it('shows loading state when post is pending', () => {
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

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows NotFound when post does not exist', () => {
    render(
      <PostDetail />,
      { wrapper: AllTheProviders() }
    )

    expect(screen.getByText('Not Found')).toBeInTheDocument()
  })
})
