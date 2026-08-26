import React from 'react'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import NotificationSettingsTab from './NotificationSettingsTab'
import MembershipSettingsRow from './MembershipSettingRow'
import SettingsToggles from './SettingToggles'
import SettingsIcon from './SettingsIcon'

function providersWithMe (settings = {}) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({
    id: '1',
    settings: {
      dmNotifications: 'none',
      commentNotifications: 'email',
      ...settings
    }
  })
  return AllTheProviders({ orm: ormSession.state })
}

describe('NotificationSettingsTab', () => {
  const currentUser = {
    id: '1',
    settings: {
      dmNotifications: 'none',
      commentNotifications: 'email',
      sendPushNotifications: true,
      sendEmail: true
    }
  }

  it('renders global and group notification sections', () => {
    render(
      <NotificationSettingsTab
        currentUser={currentUser}
        memberships={[]}
      />,
      { wrapper: providersWithMe() }
    )
    expect(screen.getByText('Global notifications')).toBeInTheDocument()
    expect(screen.getByText('Default group notifications')).toBeInTheDocument()
    expect(screen.getByText('Messages')).toBeInTheDocument()
  })
})

describe('MembershipSettingsRow', () => {
  it('renders group name', () => {
    render(
      <MembershipSettingsRow
        membership={{
          id: 1,
          settings: { sendEmail: true, digestFrequency: 'daily', postNotifications: 'all' },
          group: {
            id: '1',
            name: 'Foomunity',
            avatarUrl: 'foo.png'
          }
        }}
        updateMembershipSettings={() => {}}
      />
    )
    expect(screen.getByText('Foomunity')).toBeInTheDocument()
  })
})

describe('SettingsToggles', () => {
  it('renders email and push toggles', () => {
    render(
      <SettingsToggles
        id='test'
        name='Test Row'
        settings={{ sendEmail: true, sendPushNotifications: false }}
        update={() => {}}
        label='Test Row'
      />
    )
    expect(screen.getByText('Test Row')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Mobile Push')).toBeInTheDocument()
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
