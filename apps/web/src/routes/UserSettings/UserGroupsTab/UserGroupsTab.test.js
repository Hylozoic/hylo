import React from 'react'
import orm from 'store/models'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import UserGroupsTab from './UserGroupsTab'

jest.mock('./UserGroupsTab.store', () => ({
  ...jest.requireActual('./UserGroupsTab.store'),
  createAffiliation: () => ({ type: 'MOCK_CREATE_AFFILIATION' }),
  deleteAffiliation: () => ({ type: 'MOCK_DELETE_AFFILIATION' }),
  leaveGroup: () => ({ type: 'MOCK_LEAVE_GROUP' })
}))

function providersWithGroups () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  const me = ormSession.Me.create({ id: '1', name: 'Person 1' })
  const group1 = ormSession.Group.create({ id: '1', name: 'Group 1', slug: 'group-1' })
  const group2 = ormSession.Group.create({ id: '2', name: 'Group 2', slug: 'group-2' })
  ormSession.Membership.create({ id: '1', person: me, group: group1, settings: {} })
  ormSession.Membership.create({ id: '2', person: me, group: group2, settings: {} })

  return AllTheProviders({ orm: ormSession.state })
}

describe('UserGroupsTab', () => {
  it('renders Hylo Groups and Other Affiliations sections', async () => {
    render(<UserGroupsTab />, { wrapper: providersWithGroups() })

    await waitFor(() => {
      expect(screen.getByText('Hylo Groups')).toBeInTheDocument()
      expect(screen.getByText('Other Affiliations')).toBeInTheDocument()
      expect(screen.getByText('Group 1')).toBeInTheDocument()
      expect(screen.getByText('Group 2')).toBeInTheDocument()
    })
  })

  it('shows add affiliation control', async () => {
    render(<UserGroupsTab />, { wrapper: providersWithGroups() })

    await waitFor(() => {
      expect(screen.getByText('Add new affiliation')).toBeInTheDocument()
    })
  })
})
