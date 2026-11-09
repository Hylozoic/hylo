import { useEffect } from 'react'
import { Alert, Linking } from 'react-native'
import { API_HOST } from 'config'
import { isDev } from '../config/sentry'
import { appVersion, platformName } from '../util/platform'

type UpdateInfo = {
  type?: 'suggest' | 'force'
  title?: string
  message?: string
  link?: string
  success?: boolean
}

function showUpdateAlert (updateType: UpdateInfo) {
  if (!updateType?.type) return

  const buttons = [{
    text: 'Update Now',
    onPress: () => {
      if (updateType.link) Linking.openURL(updateType.link)
    }
  }]

  if (updateType.type === 'suggest') {
    buttons.push({ text: 'Cancel', onPress: () => {} })
  }

  Alert.alert(
    updateType.title ?? 'Update available',
    updateType.message ?? 'A new version of the app is available.',
    buttons,
    { cancelable: updateType.type === 'suggest' }
  )
}

async function checkVersion () {
  const query = `${platformName}-version=${encodeURIComponent(appVersion)}`
  const response = await fetch(`${API_HOST}/noo/mobile/check-should-update?${query}`)
  if (!response.ok) return

  const payload = await response.json() as UpdateInfo
  if (payload?.success) return
  showUpdateAlert(payload)
}

export default function VersionCheck () {
  useEffect(() => {
    if (isDev) return
    checkVersion().catch(err => console.warn('Version check failed:', err))
  }, [])

  return null
}
