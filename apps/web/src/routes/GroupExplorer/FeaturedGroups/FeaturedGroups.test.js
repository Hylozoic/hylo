import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import FeaturedGroups, { FALLBACK_GROUP_COUNT } from './FeaturedGroups'

const group = attrs => ({
  id: '1',
  name: 'Garden Circle',
  slug: 'garden-circle',
  description: 'We grow things',
  memberCount: 12,
  avatarUrl: null,
  bannerUrl: null,
  paywall: false,
  ...attrs
})

afterEach(() => mockGraphqlServer.resetHandlers())
afterAll(() => mockGraphqlServer.close())

describe('FeaturedGroups', () => {
  it('shows the most recently active listed groups when there is no curated list', async () => {
    const requests = []
    mockGraphqlServer.resetHandlers(
      graphql.query('FetchGroups', ({ variables }) => {
        requests.push(variables)
        return HttpResponse.json({ data: { groups: { hasMore: false, total: 2, items: [group(), group({ id: '2', name: 'Pond Watchers', slug: 'pond' })] } } })
      })
    )

    render(<FeaturedGroups groupIds={[]} />)

    expect(await screen.findByText('Recently active groups', {}, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByText('Garden Circle')).toBeInTheDocument()
    expect(screen.getByText('Pond Watchers')).toBeInTheDocument()
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ sortBy: 'recent', allowedInPublic: true, first: FALLBACK_GROUP_COUNT })
    expect(requests[0].groupIds).toBeUndefined()
  }, 30000)

  it('shows the curated groups in their order when a list is set', async () => {
    const requests = []
    mockGraphqlServer.resetHandlers(
      graphql.query('FetchGroups', ({ variables }) => {
        requests.push(variables)
        return HttpResponse.json({ data: { groups: { hasMore: false, total: 2, items: [group(), group({ id: '2', name: 'Pond Watchers', slug: 'pond' })] } } })
      })
    )

    render(<FeaturedGroups groupIds={['2', '1']} />)

    expect(await screen.findByText('Featured Groups', {}, { timeout: 10000 })).toBeInTheDocument()
    const names = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(names).toEqual(['Pond Watchers', 'Garden Circle'])
    expect(requests[0]).toMatchObject({ groupIds: ['2', '1'] })
    expect(requests[0].sortBy).toBeUndefined()
  }, 30000)

  it('shows nothing when no listed group has been found', async () => {
    mockGraphqlServer.resetHandlers(
      graphql.query('FetchGroups', () => HttpResponse.json({ data: { groups: { hasMore: false, total: 0, items: [] } } }))
    )

    const { container } = render(<FeaturedGroups groupIds={[]} />)

    await waitFor(() => expect(container.querySelector('[data-testid="loading-indicator"]')).toBeNull(), { timeout: 10000 })
    expect(screen.queryByText('Recently active groups')).not.toBeInTheDocument()
  }, 30000)
})
