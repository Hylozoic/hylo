import React from 'react'
import SettingsMenu from 'components/SettingsMenu'
import GroupSettingsWebView from 'screens/GroupSettingsWebView'
import useRouteParams from 'hooks/useRouteParams'

export default function GroupSettingsMenu () {
  const routeParams = useRouteParams()
  console.log('!!! routeParams', routeParams)
  const basePath = `/groups/${routeParams.groupSlug}/settings`
  const settingsOptions = [
    { name: 'Group Details', path: basePath },
    { name: 'Agreements', path: basePath + '/agreements' },
    { name: 'Responsibilities', path: basePath + '/responsibilities' },
    { name: 'Roles & Badges', path: basePath + '/roles' },
    { name: 'Privacy & Access', path: basePath + '/privacy' },
    { name: 'Topics', path: basePath + '/topics' },
    { name: 'Invitations', path: basePath + '/invite' },
    { name: 'Join Requests', path: basePath + '/requests' },
    { name: 'Related Groups', path: basePath + '/relationships' },
    { name: 'Export Data', path: basePath + '/export' },
    // TODO: Routing - Does not seem to currently appear on Web so leaving it out here
    // { name: 'Custom Views', path: basePath + '/views' },
    { name: 'Delete', path: basePath + '/delete' }
  ]

  return <SettingsMenu title='Group Settings' settingsOptions={settingsOptions} WebViewComponent={GroupSettingsWebView} />
}