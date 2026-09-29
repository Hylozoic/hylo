import React from 'react'
import { graphql, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, waitFor, within } from 'util/testing/reactTestingLibraryExtended'
import ExplorerReview from './ExplorerReview'

const reviewGroup = attrs => ({
  id: '1',
  name: 'Garden Circle',
  slug: 'garden-circle',
  avatarUrl: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  status: 'pending',
  memberCount: 4,
  recentPostCount: 2,
  lastPostAt: '2026-09-20T00:00:00.000Z',
  meetsBar: true,
  ...attrs
})

afterEach(() => mockGraphqlServer.resetHandlers())
afterAll(() => mockGraphqlServer.close())

describe('ExplorerReview', () => {
  it('lists pending groups with a recommendation and removes a group once it is approved', async () => {
    const decisions = []
    mockGraphqlServer.resetHandlers(
      graphql.query('ExplorerReviewList', () => HttpResponse.json({
        data: {
          explorerReviewList: {
            minMembers: 3,
            activityWindowDays: 90,
            pending: [
              reviewGroup(),
              reviewGroup({ id: '2', name: 'Quiet Pond', slug: 'quiet-pond', memberCount: 1, recentPostCount: 0, lastPostAt: null, meetsBar: false })
            ],
            keepOrUnlist: []
          }
        }
      })),
      graphql.mutation('ReviewExplorerGroup', ({ variables }) => {
        decisions.push(variables)
        return HttpResponse.json({ data: { reviewExplorerGroup: { id: variables.groupId, status: 'approved' } } })
      })
    )
    const user = userEvent.setup()

    render(<ExplorerReview />)

    expect(await screen.findByText('Garden Circle', {}, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByText('Recommended: Approve')).toBeInTheDocument()
    expect(screen.getByText('Recommended: Deny')).toBeInTheDocument()
    expect(screen.getByText(/No posts yet/)).toBeInTheDocument()
    expect(screen.queryByTestId('explorer-recheck')).not.toBeInTheDocument()

    const row = screen.getByText('Garden Circle').closest('li')
    await user.click(within(row).getByRole('button', { name: 'Approve' }))

    await waitFor(() => expect(screen.queryByText('Garden Circle')).not.toBeInTheDocument(), { timeout: 10000 })
    expect(decisions).toEqual([{ groupId: '1', decision: 'approve' }])
    expect(screen.getByText('Quiet Pond')).toBeInTheDocument()
  }, 30000)

  it('shows listed groups that no longer pass the bar with Keep and Unlist', async () => {
    mockGraphqlServer.resetHandlers(
      graphql.query('ExplorerReviewList', () => HttpResponse.json({
        data: {
          explorerReviewList: {
            minMembers: 3,
            activityWindowDays: 90,
            pending: [],
            keepOrUnlist: [reviewGroup({ id: '9', name: 'Old Orchard', status: 'keep_or_unlist', meetsBar: false })]
          }
        }
      }))
    )

    render(<ExplorerReview />)

    const section = await screen.findByTestId('explorer-recheck', {}, { timeout: 10000 })
    expect(within(section).getByText('Old Orchard')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Keep' })).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Unlist' })).toBeInTheDocument()
    expect(screen.getByText('No groups are waiting for review.')).toBeInTheDocument()
  }, 30000)
})
