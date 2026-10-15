import React from 'react'
import userEvent from '@testing-library/user-event'
import orm from 'store/models'
import { GROUP_ACCESSIBILITY, GROUP_TYPES, GROUP_VISIBILITY } from 'store/models/Group'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import InviteMembersDialog from './InviteMembersDialog'

const topLevelGroup = {
  id: '1',
  name: 'Go Team',
  slug: 'goteam',
  visibility: GROUP_VISIBILITY.Protected,
  accessibility: GROUP_ACCESSIBILITY.Open
}

const hostRole = {
  id: '5',
  groupId: '1',
  name: 'Host',
  responsibilities: { items: [{ id: '2', title: 'Add Members' }] }
}

function providers ({ group, roles = [] }) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Group.create(group)
  if (group.parentId) ormSession.Group.create({ ...topLevelGroup, id: group.parentId })
  ormSession.Me.create({ id: '10', name: 'Tester', groupRoles: { items: roles } })
  return AllTheProviders({ orm: ormSession.state, pending: {} })
}

function renderDialog ({ group, roles }) {
  return render(<InviteMembersDialog group={group} alwaysVisible />, null, providers({ group, roles }))
}

describe('InviteMembersDialog', () => {
  it('is hidden when the person cannot add members', () => {
    renderDialog({ group: topLevelGroup })

    expect(screen.queryByRole('button', { name: 'Invite Members' })).not.toBeInTheDocument()
  })

  it('opens the invite page for someone who can add members', async () => {
    const user = userEvent.setup()
    renderDialog({ group: topLevelGroup, roles: [hostRole] })

    await user.click(screen.getByRole('button', { name: 'Invite Members' }))

    expect(await screen.findByText('Invite people on Hylo')).toBeInTheDocument()
    expect(screen.getByText('Send Invites via email')).toBeInTheDocument()
  })

  it('shows in a space for someone who can add members', () => {
    renderDialog({
      group: { id: '2', name: 'A Space', slug: 'a-space', type: GROUP_TYPES.space, parentId: '1' },
      roles: [hostRole]
    })

    expect(screen.getByRole('button', { name: 'Invite Members' })).toBeInTheDocument()
  })
})
