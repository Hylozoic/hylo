import React from 'react'
import SettingsMenu from 'components/SettingsMenu'
import UserSettingsWebView from 'screens/UserSettingsWebView'

export default function UserSettingsMenu () {
  const settingsOptions = [
    { name: 'Edit Profile', path: '/settings' },
    { name: 'Affiliations', path: '/settings/groups' },
    { name: 'Invites & Requests', path: '/settings/invitations' },
    { name: 'Notifications', path: '/settings/notifications' },
    { name: 'Account', path: '/settings/account' },
    { name: 'Saved Searches', path: '/settings/saved-searches' },
    { name: 'Terms & Privacy', uri: 'https://hylo-landing.surge.sh/terms' }
  ]

  return <SettingsMenu title='Settings' settingsOptions={settingsOptions} WebViewComponent={UserSettingsWebView} />
}
