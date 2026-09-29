import React from 'react'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import orm from 'store/models'
import { render, screen, fireEvent, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import Members from './Members'

jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn(() => ({ type: 'TRACK_ANALYTICS_EVENT' })))

let mockGroupSlug
jest.mock('contexts/SpaceGroupContext', () => ({
  ...jest.requireActual('contexts/SpaceGroupContext'),
  useEffectiveGroupSlug: () => mockGroupSlug
}))

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({
    id: '1',
    name: 'You',
    memberships: [ormSession.Membership.create({
      id: '1',
      group: '1'
    })]
  })
  ormSession.Group.create({
    id: '1',
    slug: 'goteam',
    name: 'Go Team',
    memberCount: 3,
    members: [
      { id: '1', name: 'You', groupRoles: { items: [] } },
      { id: '2', name: 'Me', groupRoles: { items: [] } },
      { id: '3', name: 'Everyone', groupRoles: { items: [] } }
    ]
  })

  const reduxState = { orm: ormSession.state, pending: {} }

  return AllTheProviders(reduxState)
}

describe('Members', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <Members
        group={{ id: '1', slug: 'goteam', name: 'Go Team' }}
        members={[]}
        fetchMembers={jest.fn(() => Promise.resolve({ payload: { data: {} } }))}
        fetchMemberSuggestions={jest.fn(() => Promise.resolve({ payload: { data: {} } }))}
        canModerate
      />,
      null,
      testProviders()
    )

    expect(container.querySelector('#root') || container).toBeTruthy()
  })
})

describe('Members header Invite pill', () => {
  function HeaderActions () {
    const { headerDetails } = useViewHeader()
    return headerDetails.headerActions || null
  }

  function providers ({ myInviteAccess, roles = [] }) {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create({ id: '1', slug: 'goteam', name: 'Go Team', memberCount: 3, myInviteAccess })
    ormSession.Me.create({
      id: '1',
      name: 'You',
      groupRoles: { items: roles },
      memberships: [ormSession.Membership.create({ id: '1', group: '1' })]
    })
    return AllTheProviders({ orm: ormSession.state, pending: {} })
  }

  function renderMembers (options) {
    return render(<><Members /><HeaderActions /></>, null, providers(options))
  }

  beforeEach(() => { mockGroupSlug = 'goteam' })
  afterEach(() => { mockGroupSlug = undefined })

  it('shows for a member with limited invite access', () => {
    renderMembers({ myInviteAccess: 'limited' })

    expect(screen.getByRole('button', { name: 'Invite Members' })).toBeInTheDocument()
  })

  it('shows for someone who can add members', () => {
    const host = { id: '5', groupId: '1', name: 'Host', responsibilities: { items: [{ id: '2', title: 'Add Members' }] } }
    renderMembers({ myInviteAccess: 'full', roles: [host] })

    expect(screen.getByRole('button', { name: 'Invite Members' })).toBeInTheDocument()
  })

  it('is hidden for a member when only stewards can invite', () => {
    renderMembers({ myInviteAccess: null })

    expect(screen.queryByRole('button', { name: 'Invite Members' })).not.toBeInTheDocument()
  })
})

describe('Members sort options', () => {
  function providers ({ withLocation }) {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create({ id: '1', slug: 'goteam', name: 'Go Team', memberCount: 3 })
    if (withLocation) ormSession.Location.create({ id: '9', center: { lat: 48.75, lng: -122.48 } })
    ormSession.Me.create({
      id: '1',
      name: 'You',
      locationObject: withLocation ? '9' : null,
      memberships: [ormSession.Membership.create({ id: '1', group: '1' })]
    })
    return AllTheProviders({ orm: ormSession.state, pending: {} })
  }

  beforeEach(() => { mockGroupSlug = 'goteam' })
  afterEach(() => { mockGroupSlug = undefined })

  it('offers Distance when you have a location', () => {
    render(<Members />, null, providers({ withLocation: true }))
    fireEvent.click(screen.getByText(/Sort by/))
    expect(screen.getByText('Distance')).toBeInTheDocument()
  })

  it('leaves Distance out when you have no location to measure from', () => {
    render(<Members />, null, providers({ withLocation: false }))
    fireEvent.click(screen.getByText(/Sort by/))
    expect(screen.getByText('Join Date')).toBeInTheDocument()
    expect(screen.queryByText('Distance')).not.toBeInTheDocument()
  })

  it('records a sort change without the search text', () => {
    render(<Members />, null, providers({ withLocation: true }))
    fireEvent.click(screen.getByText(/Sort by/))
    fireEvent.click(screen.getByText('Join Date'))

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Member Directory Filtered', { sort: 'join', filterKind: 'sort', hasSearch: false })
  })
})
