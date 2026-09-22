import React from 'react'
import { screen, waitFor } from '@testing-library/react'
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

function setupProviders () {
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
    paywall: false,
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

function renderPage () {
  return render(<SpaceJoinPage />, null, setupProviders())
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
})
