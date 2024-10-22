import React from 'react'
import { screen, within } from '@testing-library/react'
import { render, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import Events from './Events'
import { orm } from 'store/models'

describe('Events', () => {
  const setupReduxState = () => {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Me.create({ id: '1' })
    return { orm: ormSession.state }
  }

  it('renders a post list', () => {
    const posts = [
      { id: '1', title: 'Event 1', groups: [] },
      { id: '2', title: 'Event 2', groups: [] },
      { id: '3', title: 'Event 3', groups: [] }
    ]

    render(
      <Events
        posts={posts}
        fetchEvents={jest.fn()}
        timeframe='future'
        currentUserHasMemberships
      />,
      {
        wrapper: ({ children }) => (
          <AllTheProviders reduxState={setupReduxState()}>{children}</AllTheProviders>
        )
      }
    )

    const eventCards = screen.getAllByTestId('post-card')
    expect(eventCards).toHaveLength(3)

    posts.forEach((post) => {
      const card = screen.getByText(post.title).closest('[data-testid="post-card"]')
      expect(card).toBeInTheDocument()
    })
  })

  it('displays the GroupBanner', () => {
    render(
      <Events
        posts={[]}
        fetchEvents={jest.fn()}
        timeframe='future'
      />,
      {
        wrapper: ({ children }) => (
          <AllTheProviders reduxState={setupReduxState()}>{children}</AllTheProviders>
        )
      }
    )

    const groupBanner = screen.getByTestId('group-banner')
    expect(groupBanner).toBeInTheDocument()
  })

  it('displays the correct timeframe dropdown', () => {
    render(
      <Events
        posts={[]}
        fetchEvents={jest.fn()}
        timeframe='future'
      />,
      {
        wrapper: ({ children }) => (
          <AllTheProviders reduxState={setupReduxState()}>{children}</AllTheProviders>
        )
      }
    )

    const dropdown = screen.getByText('Upcoming Events')
    expect(dropdown).toBeInTheDocument()
  })

  it('displays a message when there are no events', () => {
    render(
      <Events
        posts={[]}
        fetchEvents={jest.fn()}
        timeframe='future'
      />,
      {
        wrapper: ({ children }) => (
          <AllTheProviders reduxState={setupReduxState()}>{children}</AllTheProviders>
        )
      }
    )

    const noEventsMessage = screen.getByText('No upcoming events')
    expect(noEventsMessage).toBeInTheDocument()
  })
})
