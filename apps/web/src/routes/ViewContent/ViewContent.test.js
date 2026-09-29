/* eslint-env jest */
import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import ViewContent from './ViewContent'

function providers ({ withMembership }) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1', name: 'Test User', settings: {} })
  if (withMembership) {
    ormSession.Group.create({ id: '1', name: 'Test Group', slug: 'test-group' })
    ormSession.Membership.create({ id: '1', group: '1', person: '1' })
  }
  return AllTheProviders({ orm: ormSession.state })
}

describe('ViewContent empty stream', () => {
  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('PostsQuery', () => HttpResponse.json({
        data: { posts: { hasMore: false, total: 0, items: [] } }
      }))
    )
  })

  it('points someone who is in no groups to exploring or creating one', async () => {
    render(<ViewContent context='all' view='stream' />, { wrapper: providers({ withMembership: false }) })

    expect(await screen.findByText('You\'re not in any groups yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Explore Groups' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create a group' })).toBeInTheDocument()
  })

  it('keeps the usual empty message for group members', async () => {
    render(<ViewContent context='all' view='stream' />, { wrapper: providers({ withMembership: true }) })

    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument()
    expect(screen.queryByText('You\'re not in any groups yet')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Explore Groups' })).not.toBeInTheDocument()
  })
})

describe('ViewContent What\'s new divider', () => {
  const lastVisit = new Date('2026-09-10T00:00:00.000Z')
  const post = (id, createdAt) => ({
    id,
    title: `Post ${id}`,
    details: '',
    type: 'discussion',
    createdAt,
    updatedAt: createdAt,
    creator: { id: '2', name: 'Someone', avatarUrl: '' },
    groups: [{ id: '1', name: 'Group 1', slug: 'group-1' }],
    commenters: [],
    commentersTotal: 0,
    commentsTotal: 0,
    members: { items: [] },
    topics: [],
    attachments: []
  })

  function providersInGroups (count) {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Me.create({ id: '1', name: 'Test User', settings: {} })
    for (let i = 1; i <= count; i++) {
      ormSession.Group.create({ id: String(i), name: `Group ${i}`, slug: `group-${i}` })
      ormSession.Membership.create({ id: String(i), group: String(i), person: '1' })
    }
    return AllTheProviders({ orm: ormSession.state })
  }

  beforeEach(() => {
    window.sessionStorage.setItem('hylo-visit-baseline:1', String(lastVisit.getTime()))
    mockGraphqlServer.use(
      graphql.query('PostsQuery', () => HttpResponse.json({
        data: {
          posts: {
            hasMore: false,
            total: 3,
            items: [
              post('3', '2026-09-12T00:00:00.000Z'),
              post('2', '2026-09-11T00:00:00.000Z'),
              post('1', '2026-09-01T00:00:00.000Z')
            ]
          }
        }
      }))
    )
  })

  afterEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  it('marks where posts from before the last visit begin, for people in 3+ groups', async () => {
    render(<ViewContent context='all' view='all' />, { wrapper: providersInGroups(3) })

    const divider = await screen.findByTestId('new-since-divider')
    expect(divider).toHaveAccessibleName('New since your last visit')
    const newer = screen.getByText('Post 2')
    const older = screen.getByText('Post 1')
    expect(newer.compareDocumentPosition(divider) & window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(divider.compareDocumentPosition(older) & window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('leaves the feed as it is for people in fewer than 3 groups', async () => {
    render(<ViewContent context='all' view='all' />, { wrapper: providersInGroups(2) })

    expect(await screen.findByText('Post 1')).toBeInTheDocument()
    expect(screen.queryByTestId('new-since-divider')).not.toBeInTheDocument()
  })
})
