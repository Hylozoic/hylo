import React from 'react'
import userEvent from '@testing-library/user-event'
import orm from 'store/models'
import { GROUP_ACCESSIBILITY, GROUP_TYPES, GROUP_VISIBILITY } from 'store/models/Group'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import InviteMembersDialog, { inviteAccessFor } from './InviteMembersDialog'

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

describe('inviteAccessFor', () => {
  it('is full for people who can add members, whatever the group says', () => {
    expect(inviteAccessFor({ id: '1' }, true)).toBe('full')
    expect(inviteAccessFor({ id: '2', type: GROUP_TYPES.space, parentId: '1' }, true)).toBe('full')
  })

  it('is limited only when the server says so for a top-level group', () => {
    expect(inviteAccessFor({ id: '1', myInviteAccess: 'limited' }, false)).toBe('limited')
    expect(inviteAccessFor({ id: '2', parentId: '1', myInviteAccess: 'limited' }, false)).toBeNull()
    expect(inviteAccessFor({ id: '2', type: GROUP_TYPES.space, myInviteAccess: 'limited' }, false)).toBeNull()
  })

  it('is null when the field is missing, null or unexpected', () => {
    expect(inviteAccessFor({ id: '1' }, false)).toBeNull()
    expect(inviteAccessFor({ id: '1', myInviteAccess: null }, false)).toBeNull()
    expect(inviteAccessFor({ id: '1', myInviteAccess: 'full' }, false)).toBeNull()
    expect(inviteAccessFor(null, false)).toBeNull()
  })
})

describe('InviteMembersDialog', () => {
  it('is hidden for a member when only stewards can invite', () => {
    renderDialog({ group: { ...topLevelGroup, myInviteAccess: null } })

    expect(screen.queryByRole('button', { name: 'Invite Members' })).not.toBeInTheDocument()
  })

  it('opens the limited invite page when the member has limited access', async () => {
    const user = userEvent.setup()
    renderDialog({ group: { ...topLevelGroup, myInviteAccess: 'limited' } })

    await user.click(screen.getByRole('button', { name: 'Invite Members' }))

    expect(await screen.findByText('Send Invites via email')).toBeInTheDocument()
    expect(screen.getByText('Enter up to 10 email addresses at a time, separated by commas or new lines')).toBeInTheDocument()
    expect(screen.queryByText('Share a Join Link')).not.toBeInTheDocument()
    expect(screen.queryByText('Invite people on Hylo')).not.toBeInTheDocument()
    expect(screen.queryByText('Assign a role to invitees (optional):')).not.toBeInTheDocument()
  })

  it('opens the full invite page for someone who can add members even without myInviteAccess', async () => {
    const user = userEvent.setup()
    renderDialog({ group: topLevelGroup, roles: [hostRole] })

    await user.click(screen.getByRole('button', { name: 'Invite Members' }))

    expect(await screen.findByText('Share a Join Link')).toBeInTheDocument()
    expect(screen.getByText('Invite people on Hylo')).toBeInTheDocument()
    expect(screen.getByText('Assign a role to invitees (optional):')).toBeInTheDocument()
  })

  it('is hidden in a space for someone with limited access', () => {
    renderDialog({
      group: { id: '2', name: 'A Space', slug: 'a-space', type: GROUP_TYPES.space, parentId: '1', myInviteAccess: 'limited' }
    })

    expect(screen.queryByRole('button', { name: 'Invite Members' })).not.toBeInTheDocument()
  })

  it('still shows in a space for someone who can add members in the parent group', () => {
    renderDialog({
      group: { id: '2', name: 'A Space', slug: 'a-space', type: GROUP_TYPES.space, parentId: '1' },
      roles: [hostRole]
    })

    expect(screen.getByRole('button', { name: 'Invite Members' })).toBeInTheDocument()
  })
})
