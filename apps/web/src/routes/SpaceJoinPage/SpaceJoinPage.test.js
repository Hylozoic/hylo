import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AllTheProviders, render } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import { GROUP_ACCESSIBILITY, GROUP_TYPES } from 'store/models/Group'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import rejoinGroup from 'store/actions/rejoinGroup'
import SpaceJoinPage from './SpaceJoinPage'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}))

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
jest.mock('store/actions/rejoinGroup', () => jest.fn(() => ({ type: 'RejoinGroup/REJOIN_GROUP' })))

function setupProviders ({ retainedAccess = false, parentMember = false } = {}) {
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
    paywall: retainedAccess,
    hasValidScope: retainedAccess,
    currentUserMembershipActive: retainedAccess ? false : null,
    requiredRoles: [],
    bannerUrl: 'https://example.com/banner.jpg',
    memberCount: 3
  })
  ormSession.Me.create({
    id: '1',
    name: 'Test User',
    groupRoles: { items: [] }
  })
  if (parentMember) {
    ormSession.Membership.create({ id: 'parent-membership', person: '1', group: '10' })
  }

  return AllTheProviders({ orm: ormSession.state }, ['/groups/parent-group/spaces/invite-space'])
}

function renderPage ({ retainedAccess = false, parentMember = false } = {}) {
  return render(
    <SpaceJoinPage />,
    null,
    setupProviders({ retainedAccess, parentMember })
  )
}

describe('SpaceJoinPage', () => {
  afterEach(() => {
    getQuerystringParam.mockReset()
    rejoinGroup.mockClear()
    mockNavigate.mockClear()
  })

  it('auto-joins from an access code instead of showing the invite-only page', async () => {
    getQuerystringParam.mockImplementation((key) => key === 'accessCode' ? 'space-code' : null)
    renderPage()
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('This space is invite only. You need an invitation to join.')).not.toBeInTheDocument()
    })
  })

  it('shows retained access and reactivates the membership before navigating home', async () => {
    getQuerystringParam.mockReturnValue(null)
    renderPage({ retainedAccess: true, parentMember: true })

    expect(screen.getByText('You are not currently a member of Invite Space, but your access is still valid. Rejoin to participate again.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Rejoin Invite Space' }))

    await waitFor(() => {
      expect(rejoinGroup).toHaveBeenCalledWith('20')
      expect(mockNavigate).toHaveBeenCalledWith('/groups/parent-group/spaces/invite-space/all')
    })
  })

  it('links retained-access space users to the parent About page when they are no longer parent members', () => {
    getQuerystringParam.mockReturnValue(null)
    renderPage({ retainedAccess: true })

    expect(screen.getByText('To rejoin this space, you need to be a member of its parent group first.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Parent Group about page' })).toHaveAttribute('href', '/groups/parent-group/about')
    expect(screen.queryByRole('button', { name: 'Rejoin Invite Space' })).not.toBeInTheDocument()
  })

  it('does not show Join Space for an invite-only space without a link', () => {
    getQuerystringParam.mockReturnValue(null)
    renderPage()
    expect(screen.queryByRole('button', { name: 'Join Space' })).not.toBeInTheDocument()
    expect(screen.getByText('This space is invite only. You need an invitation to join.')).toBeInTheDocument()
  })
})
