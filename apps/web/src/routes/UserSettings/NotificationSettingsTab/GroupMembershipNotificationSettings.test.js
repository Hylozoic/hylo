import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import GroupMembershipNotificationSettings from './GroupMembershipNotificationSettings'

// Roles the viewer holds, by group id
const mockRoles = {
  1: [{ id: '10', name: 'Host', active: true, groupId: '1' }],
  2: [{ id: '20', name: 'Gardener', active: true, groupId: '2' }],
  3: [{ id: '30', name: 'Moderator', active: false, groupId: '3' }]
}

jest.mock('store/selectors/getRolesForGroup', () => (state, { groupId }) => mockRoles[groupId] || [])

const settings = { sendEmail: true, sendPushNotifications: true, postNotifications: 'important', digestFrequency: 'daily' }

function renderFor (props) {
  const update = jest.fn()
  render(<GroupMembershipNotificationSettings id='m1' settings={settings} update={update} {...props} />)
  return update
}

describe('GroupMembershipNotificationSettings: weekly steward email', () => {
  it('shows the toggle to a steward, on by default, and saves stewardDigest', () => {
    const update = renderFor({ groupId: '1' })
    expect(screen.getByText('Weekly steward email')).toBeInTheDocument()
    const toggle = screen.getByRole('switch', { name: /Weekly steward email/ })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(toggle)
    expect(update).toHaveBeenCalledWith({ stewardDigest: false })
  })

  it('shows it off when the steward turned it off', () => {
    render(<GroupMembershipNotificationSettings id='m1' groupId='1' settings={{ ...settings, stewardDigest: false }} update={jest.fn()} />)
    expect(screen.getByRole('switch', { name: /Weekly steward email/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('hides it from members without a steward role', () => {
    renderFor({ groupId: '2' })
    expect(screen.queryByText('Weekly steward email')).not.toBeInTheDocument()
  })

  it('hides it for an inactive steward role', () => {
    renderFor({ groupId: '3' })
    expect(screen.queryByText('Weekly steward email')).not.toBeInTheDocument()
  })

  it('hides it on the all-groups defaults and for spaces', () => {
    renderFor({})
    expect(screen.queryByText('Weekly steward email')).not.toBeInTheDocument()
    renderFor({ groupId: '1', postsOnly: true })
    expect(screen.queryAllByText('Weekly steward email')).toHaveLength(0)
  })
})
