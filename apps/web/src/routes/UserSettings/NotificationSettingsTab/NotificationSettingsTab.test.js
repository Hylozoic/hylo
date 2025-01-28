import React from 'react'
import { render, screen, fireEvent, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import NotificationSettingsTab from './NotificationSettingsTab'
import AllGroupsSettingsRow from './AllGroupsSettingRow'
import MembershipSettingsRow from './MembershipSettingRow'
import SettingsRow from './SettingToggles'
import SettingsIcon from './SettingIcon'

describe('NotificationSettingsTab', () => {
  const currentUser = {
    hasDevice: true,
    settings: {
      dmNotifications: 'none',
      commentNotifications: 'email',
      sendPushNotifications: true,
      sendEmail: true
    }
  }

  it('renders correctly', () => {
    render(
      <NotificationSettingsTab
        currentUser={currentUser}
        messageSettings={{
          sendEmail: true
        }}
        allGroupsSettings={{
          sendEmail: true
        }}
        updateUserSettings={() => {}}
        memberships={[{ id: 1, settings: { sendEmail: true }, group: { name: 'Group 1', avatarUrl: 'group1.png' } }, { id: 2, settings: { sendEmail: true }, group: { name: 'Group 2', avatarUrl: 'group2.png' } }]}
      />
    )
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('How often would you like to receive email digests for new posts in your groups and saved searches?')).toBeInTheDocument()
  })

  it("hides mobile options if user doesn't have device", () => {
    render(
      <NotificationSettingsTab
        memberships={[]}
        messageSettings={{
          sendEmail: true
        }}
        allGroupsSettings={{
          sendEmail: true
        }}
        currentUser={{
          ...currentUser,
          hasDevice: false
        }}
      />
    )
    const selectOptions = screen.getAllByRole('option')
    expect(selectOptions.filter(option => option.textContent === 'Mobile App')).toHaveLength(0)
  })

  it("sets email option if user doesn't have device and 'both' was selected", () => {
    render(
      <NotificationSettingsTab
        messageSettings={{
          sendEmail: true
        }}
        allGroupsSettings={{
          sendEmail: true
        }}
        memberships={[]}
        currentUser={{
          ...currentUser,
          settings: {
            ...currentUser.settings,
            commentNotifications: 'both'
          },
          hasDevice: false
        }}
      />
    )
    expect(screen.getByRole('option', { name: 'Email', selected: true })).toBeInTheDocument()
  })

  describe('updateMessageSettings', () => {
    it('calls updateUserSettings', () => {
      const updateUserSettings = jest.fn()
      render(
        <NotificationSettingsTab
          messageSettings={{
            sendEmail: true
          }}
          allGroupsSettings={{
            sendEmail: true
          }}
          currentUser={currentUser}
          updateUserSettings={updateUserSettings}
          memberships={[]}
        />
      )

      const pushNotificationToggle = screen.getAllByText('Off')[0]
      fireEvent.click(pushNotificationToggle)
      expect(updateUserSettings).toHaveBeenCalledWith({ settings: { dmNotifications: 'both' } })

      const emailNotificationToggle = screen.getAllByText('On')[0]
      fireEvent.click(emailNotificationToggle)
      expect(updateUserSettings).toHaveBeenCalledWith({ settings: { dmNotifications: 'none' } })
    })
  })

  describe('updateAllGroups', () => {
    it('calls updateAllMemberships', () => {
      const updateAllMemberships = jest.fn()
      render(
        <NotificationSettingsTab
          messageSettings={{
            sendEmail: true,
            sendPushNotifications: false
          }}
          allGroupsSettings={{
            sendEmail: true,
            sendPushNotifications: false
          }}
          currentUser={currentUser}
          updateAllMemberships={updateAllMemberships}
          memberships={[
            { id: 1, group: { id: 1 }, settings: { sendEmail: true, sendPushNotifications: false } },
            { id: 2, group: { id: 2 }, settings: { sendEmail: true, sendPushNotifications: false } }
          ]}
        />
      )

      const pushNotificationToggle = screen.getAllByText('Off')[1]
      fireEvent.click(pushNotificationToggle)
      expect(updateAllMemberships).toHaveBeenCalledWith({ sendPushNotifications: true })
    })
  })
})

describe('AllGroupsSettingsRow', () => {
  it('renders correctly', () => {
    render(
      <AllGroupsSettingsRow
        settings={{ sendEmail: true }}
        updateAllGroups={() => {}}
      />
    )
    expect(screen.getByText('All Groups')).toBeInTheDocument()
    expect(screen.getByText('On')).toBeInTheDocument()
  })
})

describe('MembershipSettingsRow', () => {
  it('renders correctly', () => {
    render(
      <MembershipSettingsRow
        membership={{
          id: 1,
          settings: { sendEmail: true },
          group: {
            name: 'Foomunity',
            avatarUrl: 'foo.png'
          }
        }}
        updateMembershipSettings={() => {}}
      />
    )
    expect(screen.getByText('Foomunity')).toBeInTheDocument()
    expect(screen.getByText('On')).toBeInTheDocument()
  })
})

describe('SettingsRow', () => {
  it('renders correctly', () => {
    render(
      <SettingsRow
        name='Test Row'
        settings={{ sendEmail: true }}
        update={() => {}}
      />
    )
    expect(screen.getByText('Test Row')).toBeInTheDocument()
    expect(screen.getByText('On')).toBeInTheDocument()
  })
})

describe('SettingsIcon', () => {
  it('renders correctly', () => {
    render(
      <SettingsIcon
        settingKey='sendEmail'
        name='EmailNotification'
        settings={{ sendEmail: true }}
        update={() => {}}
      />
    )
    expect(screen.getByText('On')).toBeInTheDocument()
  })
})
