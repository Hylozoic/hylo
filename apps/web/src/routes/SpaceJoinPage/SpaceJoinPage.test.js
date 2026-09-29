import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import { GROUP_ACCESSIBILITY, GROUP_TYPES } from 'store/models/Group'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import SpaceJoinPage from './SpaceJoinPage'

jest.mock('hooks/useGetJoinRequests', () => ({
  useKeyJoinRequestsByGroupId: () => ({})
}))

jest.mock('hooks/useRouteParams', () => () => ({ groupSlug: 'parent-group' }))

jest.mock('contexts/SpaceGroupContext', () => ({
  useEffectiveGroupSlug: () => 'parent-group-invite-space'
}))

jest.mock('contexts/ViewHeaderContext', () => ({
  useViewHeader: () => ({ setHeaderDetails: jest.fn() })
}))

jest.mock('routes/AuthLayoutRouter/components/ContextMenu/MenuRowBackground', () => () => null)

jest.mock('store/selectors/getQuerystringParam', () => jest.fn())

jest.mock('store/actions/joinSpace', () => () => ({ type: 'SpaceJoinPage/JOIN_SPACE' }))

function setupProviders ({ paywall = false } = {}) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Group.create({
    id: '10',
    name: 'Parent Group',
    slug: 'parent-group',
    groupRoles: { items: [] }
  })
  ormSession.Group.create({
    id: '20',
    name: 'Invite Space',
    slug: 'parent-group-invite-space',
    type: GROUP_TYPES.space,
    parentId: '10',
    accessibility: GROUP_ACCESSIBILITY.Closed,
    paywall,
    requiredRoles: [],
    bannerUrl: 'https://example.com/banner.jpg',
    memberCount: 3
  })
  ormSession.Me.create({
    id: '1',
    name: 'Test User',
    groupRoles: { items: [] }
  })

  return AllTheProviders({ orm: ormSession.state }, ['/groups/parent-group/spaces/invite-space'])
}

function renderPage (options) {
  return render(<SpaceJoinPage />, null, setupProviders(options))
}

describe('SpaceJoinPage', () => {
  afterEach(() => {
    getQuerystringParam.mockReset()
  })

  it('auto-joins from an access code instead of showing the invite-only page', async () => {
    getQuerystringParam.mockImplementation((key) => key === 'accessCode' ? 'space-code' : null)
    renderPage()
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('This space is invite only. You need an invitation to join.')).not.toBeInTheDocument()
    })
  })

  it('does not show Join Space for an invite-only space without a link', () => {
    getQuerystringParam.mockReturnValue(null)
    renderPage()
    expect(screen.queryByRole('button', { name: 'Join Space' })).not.toBeInTheDocument()
    expect(screen.getByText('This space is invite only. You need an invitation to join.')).toBeInTheDocument()
  })

  it('shows a paid track space\'s locked action titles and counts above the offerings', async () => {
    getQuerystringParam.mockReturnValue(null)
    mockGraphqlServer.use(
      http.post('*/noo/graphql', async ({ request }) => {
        const { query } = await request.json()
        if (query.includes('paywallPreview')) {
          return HttpResponse.json({
            data: {
              group: {
                id: '20',
                paywallPreview: { postTitles: [], actionTitles: ['Read the guide', 'Plant your first bed'], numActions: 2, numPeopleCompleted: 3 }
              }
            }
          })
        }
        if (query.includes('publicStripeOfferings')) {
          return HttpResponse.json({
            data: {
              publicStripeOfferings: {
                success: true,
                offerings: [{ id: '5', name: 'Season Pass', priceInCents: 1500, currency: 'usd', accessGrants: { groupIds: ['20'] } }]
              }
            }
          })
        }
        return HttpResponse.json({ data: {} })
      })
    )

    renderPage({ paywall: true })

    expect(await screen.findByText('Read the guide')).toBeInTheDocument()
    expect(screen.getByText('Plant your first bed')).toBeInTheDocument()
    expect(screen.getByTestId('paywall-preview')).toBeInTheDocument()
    expect(await screen.findByText('Season Pass')).toBeInTheDocument()
  })
})
