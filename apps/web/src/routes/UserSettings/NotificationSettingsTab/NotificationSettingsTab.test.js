import React from 'react'
import { render, screen, fireEvent, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import NotificationSettingsTab, {
  MessageSettingsRow,
  AllGroupsSettingsRow,
  MembershipSettingsRow,
  SettingsRow,
  SettingsIcon
} from './NotificationSettingsTab'

describe('NotificationSettingsTab', () => {
  const currentUser = {
    hasDevice: true,
    settings: {
      digestFrequency: 'daily',
      dmNotifications: 'none',
      commentNotifications: 'email',
      postNotifications: 'important'
    }
  }

  it('renders correctly', () => {
    render(
      <NotificationSettingsTab
        currentUser={currentUser}
        updateUserSettings={() => {}}
        memberships={[{ id: 1 }, { id: 2 }]}
      />,
      { wrapper: AllTheProviders }
    )
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('How often would you like to receive email digests for new posts in your groups and saved searches?')).toBeInTheDocument()
  })

  it("hides mobile options if user doesn't have device", () => {
    render(
      <NotificationSettingsTab
        memberships={[]}
        currentUser={{
          ...currentUser,
          hasDevice: false
        }}
      />,
      { wrapper: AllTheProviders }
    )
    const selectOptions = screen.getAllByRole('option')
    expect(selectOptions.filter(option => option.textContent === 'Mobile App')).toHaveLength(0)
  })

  it("sets email option if user doesn't have device and 'both' was selected", () => {
    render(
      <NotificationSettingsTab
        memberships={[]}
        currentUser={{
          ...currentUser,
          settings: {
            ...currentUser.settings,
            commentNotifications: 'both'
          },
          hasDevice: false
        }}
      />,
      { wrapper: AllTheProviders }
    )
    expect(screen.getByRole('option', { name: 'Email', selected: true })).toBeInTheDocument()
  })

  describe('updateMessageSettings', () => {
    it('calls updateUserSettings', () => {
      const updateUserSettings = jest.fn()
      render(
        <NotificationSettingsTab
          currentUser={currentUser}
          updateUserSettings={updateUserSettings}
          memberships={[]}
        />,
        { wrapper: AllTheProviders }
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
          currentUser={currentUser}
          updateAllMemberships={updateAllMemberships}
          memberships={[
            { group: { id: 1 } },
            { group: { id: 2 } }
          ]}
        />,
        { wrapper: AllTheProviders }
      )

      const pushNotificationToggle = screen.getAllByText('Off')[1]
      fireEvent.click(pushNotificationToggle)
      expect(updateAllMemberships).toHaveBeenCalledWith([1, 2], { sendPushNotifications: true })
    })
  })
})

describe('MessageSettingsRow', () => {
  it('renders correctly', () => {
    render(
      <MessageSettingsRow
        settings={{ sendEmail: true }}
        updateMessageSettings={() => {}}
      />,
      { wrapper: AllTheProviders }
    )
    expect(screen.getByText('Messages')).toBeInTheDocument()
    expect(screen.getByText('On')).toBeInTheDocument()
  })
})

describe('AllGroupsSettingsRow', () => {
  it('renders correctly', () => {
    render(
      <AllGroupsSettingsRow
        settings={{ sendEmail: true }}
        updateAllGroups={() => {}}
      />,
      { wrapper: AllTheProviders }
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
          settings: { sendEmail: true },
          group: {
            name: 'Foomunity',
            avatarUrl: 'foo.png'
          }
        }}
        updateMembershipSettings={() => {}}
      />,
      { wrapper: AllTheProviders }
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
      />,
      { wrapper: AllTheProviders }
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
      />,
      { wrapper: AllTheProviders }
    )
    expect(screen.getByText('On')).toBeInTheDocument()
  })
})
