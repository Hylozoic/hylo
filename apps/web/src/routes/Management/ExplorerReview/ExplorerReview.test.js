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

  it('shows only the error when the list cannot be loaded', async () => {
    mockGraphqlServer.resetHandlers(
      graphql.query('ExplorerReviewList', () => HttpResponse.json({
        errors: [{ message: 'Unauthorized: Admin access required' }],
        data: { explorerReviewList: null }
      }))
    )

    render(<ExplorerReview />)

    expect(await screen.findByRole('alert', {}, { timeout: 10000 })).toHaveTextContent('Something went wrong. Please try again.')
    expect(screen.queryByText('No groups are waiting for review.')).not.toBeInTheDocument()
    expect(screen.queryByTestId('explorer-review-row')).not.toBeInTheDocument()
  }, 30000)

  it('drops a group that stopped being Public and says why', async () => {
    mockGraphqlServer.resetHandlers(
      graphql.query('ExplorerReviewList', () => HttpResponse.json({
        data: {
          explorerReviewList: {
            minMembers: 3,
            activityWindowDays: 90,
            pending: [reviewGroup()],
            keepOrUnlist: []
          }
        }
      })),
      graphql.mutation('ReviewExplorerGroup', () => HttpResponse.json({
        errors: [{ message: 'Only Public groups can be listed in the Group Explorer', extensions: { code: 'GROUP_NOT_PUBLIC' } }],
        data: { reviewExplorerGroup: null }
      }))
    )
    const user = userEvent.setup()

    render(<ExplorerReview />)

    const row = (await screen.findByText('Garden Circle', {}, { timeout: 10000 })).closest('li')
    await user.click(within(row).getByRole('button', { name: 'Approve' }))

    expect(await screen.findByRole('alert', {}, { timeout: 10000 })).toHaveTextContent(/is no longer Public, so it was not listed/)
    expect(screen.queryByTestId('explorer-review-row')).not.toBeInTheDocument()
  }, 30000)
})
