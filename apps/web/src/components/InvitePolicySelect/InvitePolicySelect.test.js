import React from 'react'
import { fireEvent, render, screen } from 'util/testing/reactTestingLibraryExtended'
import { GROUP_ACCESSIBILITY } from 'store/models/Group'
import InvitePolicySelect, { invitePolicyRoles, invitePolicyToSave } from './InvitePolicySelect'

const APPROVAL = 'Every member can send personal email invitations. A steward approves each person they invite before they join.'
const NO_APPROVAL = 'Every member can send personal email invitations, and the people they invite join right away.'

describe('InvitePolicySelect', () => {
  const roles = [
    { id: '1', label: '🪄 Administrator', locked: true, checked: false },
    { id: '2', label: '⚖️ Moderator', locked: false, checked: true },
    { id: '7', label: '🌱 Gardener', locked: false, checked: false }
  ]

  it('offers everyone, Administrators and Hosts, and specific roles', () => {
    const onModeChange = jest.fn()
    render(<InvitePolicySelect mode='stewards' onModeChange={onModeChange} roles={roles} accessibility={GROUP_ACCESSIBILITY.Restricted} />)

    expect(screen.getByText('Only roles that include Add Members can invite people: Administrators, Hosts and any custom role you give it.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Who can add new members?' }))
    expect(screen.getByRole('button', { name: 'Everyone in the group' })).toBeInTheDocument()
    expect(screen.getAllByText('Administrators and Hosts (anyone who can add members)').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Specific roles' }))
    expect(onModeChange).toHaveBeenCalledWith('roles')
  })

  it('says stewards approve invited people in Restricted and Closed groups only', () => {
    const { rerender } = render(<InvitePolicySelect mode='everyone' onModeChange={jest.fn()} accessibility={GROUP_ACCESSIBILITY.Closed} />)
    expect(screen.getByText(APPROVAL)).toBeInTheDocument()

    rerender(<InvitePolicySelect mode='everyone' onModeChange={jest.fn()} accessibility={GROUP_ACCESSIBILITY.Open} />)
    expect(screen.getByText(NO_APPROVAL)).toBeInTheDocument()
    expect(screen.queryByText(APPROVAL)).not.toBeInTheDocument()
  })

  it('lists roles only for specific roles, with Add Members roles locked on', () => {
    const onToggleRole = jest.fn()
    const { rerender } = render(<InvitePolicySelect mode='everyone' onModeChange={jest.fn()} roles={roles} onToggleRole={onToggleRole} hint='A hint' />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByText('A hint')).not.toBeInTheDocument()

    rerender(<InvitePolicySelect mode='roles' onModeChange={jest.fn()} roles={roles} onToggleRole={onToggleRole} hint='A hint' />)
    const administrator = screen.getByRole('checkbox', { name: '🪄 Administrator' })
    expect(administrator).toBeDisabled()
    expect(administrator).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Can always invite')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '⚖️ Moderator' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: '🌱 Gardener' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('A hint')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: '🌱 Gardener' }))
    expect(onToggleRole).toHaveBeenCalledWith('7')
  })
})

describe('invitePolicyRoles', () => {
  it('lists active roles other than the Member role, locking the ones with Add Members', () => {
    const groupRoles = [
      { id: 9, name: 'Member', type: 'member', active: true },
      { id: 3, name: 'Host', emoji: '👋', type: 'system', active: true },
      { id: 1, name: 'Administrator', emoji: '🪄', type: 'system', active: true },
      { id: 2, name: 'Moderator', emoji: '⚖️', type: 'system', active: true },
      { id: 12, name: 'Door Keeper', emoji: '🚪', type: 'custom', active: true, responsibilities: { items: [{ id: 5, title: 'Add Members' }] } },
      { id: 13, name: 'Gardener', emoji: '🌱', type: 'custom', active: true },
      { id: 14, name: 'Retired', emoji: '💤', type: 'custom', active: false }
    ]

    expect(invitePolicyRoles(groupRoles, [2, '13'])).toEqual([
      { id: '1', label: '🪄 Administrator', locked: true, checked: false },
      { id: '2', label: '⚖️ Moderator', locked: false, checked: true },
      { id: '3', label: '👋 Host', locked: true, checked: false },
      { id: '12', label: '🚪 Door Keeper', locked: true, checked: false },
      { id: '13', label: '🌱 Gardener', locked: false, checked: true }
    ])
    expect(invitePolicyRoles(undefined)).toEqual([])
  })
})

describe('invitePolicyToSave', () => {
  it('saves the chosen roles, or stewards when no role beyond the locked ones is chosen', () => {
    const roles = [
      { id: '1', locked: true, checked: true },
      { id: '2', locked: false, checked: true },
      { id: '7', locked: false, checked: false }
    ]
    expect(invitePolicyToSave('roles', roles)).toEqual({ mode: 'roles', roleIds: ['1', '2'] })
    expect(invitePolicyToSave('roles', roles.map(role => ({ ...role, checked: role.locked })))).toEqual({ mode: 'stewards' })
    expect(invitePolicyToSave('everyone', roles)).toEqual({ mode: 'everyone' })
    expect(invitePolicyToSave('stewards', roles)).toEqual({ mode: 'stewards' })
  })
})
