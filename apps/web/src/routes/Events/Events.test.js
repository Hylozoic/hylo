import React from 'react'
import { screen, within } from '@testing-library/react'
import { orm } from 'store/models'
import { render, AllTheProviders, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import { CENTER_COLUMN_ID } from 'util/scrolling'
import Events from './Events'

describe('Events', () => {
  const setupReduxState = () => {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Me.create({ id: '1', name: 'Francine Wobbler' })
    ormSession.Group.create({ id: '1', name: 'Group 1', slug: 'group1' })
    return { orm: ormSession.state }
  }

  beforeAll(() => {
    const centerColumn = document.createElement('div')
    centerColumn.id = CENTER_COLUMN_ID
    document.body.appendChild(centerColumn)
  })

  beforeEach(() => {
    jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'group1' })

    mockGraphqlServer.use(
      graphql.query('FetchPost', () => HttpResponse.json({
        data: {
          post: {
            id: '1',
            title: 'Event 1',
            groups: []
          }
        }
      })),
      graphql.query('GroupPostsQuery', ({ query, variables }) => {
        return HttpResponse.json({
          data: {
            group: {
              id: '1',
              name: 'Group 1',
              slug: 'group1',
              posts: []
            }
          }
        })
      })
    )
  })

  it('renders a post list', async () => {
    const posts = [
      { id: '1', title: 'Event 1', groups: [] },
      { id: '2', title: 'Event 2', groups: [] },
      { id: '3', title: 'Event 3', groups: [] }
    ]

    mockGraphqlServer.use(
      graphql.query('GroupPostsQuery', ({ query, variables }) => {
        return HttpResponse.json({
          data: {
            group: {
              id: '1',
              name: 'Group 1',
              posts: { items: posts }
            }
          }
        })
      })
    )

    render(
      <Events
        timeframe='future'
        currentUserHasMemberships
        context='groups'
      />,
      {
        wrapper: AllTheProviders(setupReduxState())
      }
    )

    await waitFor(() => {
      const eventCards = screen.getAllByTestId('post-card')
      expect(eventCards).toHaveLength(3)

      posts.forEach((post) => {
        const card = screen.getByText(post.title).closest('[data-testid="post-card"]')
        expect(card).toBeInTheDocument()
      })
    })
  })

  it('displays the GroupBanner', () => {
    render(
      <Events
        timeframe='future'
        context='groups'
      />,
      {
        wrapper: AllTheProviders(setupReduxState())
      }
    )

    const groupBanner = screen.getByTestId('group-banner')
    expect(groupBanner).toBeInTheDocument()
  })

  it('displays the correct timeframe dropdown', async () => {
    render(
      <Events
        timeframe='future'
        context='groups'
      />,
      {
        wrapper: AllTheProviders(setupReduxState())
      }
    )

    await waitFor(() => {
      const dropdown = screen.getByText('Upcoming Events')
      expect(dropdown).toBeInTheDocument()
    })
  })

  it('displays a message when there are no events', async () => {
    render(
      <Events
        posts={[]}
        fetchEvents={jest.fn()}
        timeframe='future'
        context='groups'
      />,
      {
        wrapper: AllTheProviders(setupReduxState())
      }
    )

    await waitFor(() => {
      const noEventsMessage = screen.getByText('No upcoming events')
      expect(noEventsMessage).toBeInTheDocument()
    })
  })
})
