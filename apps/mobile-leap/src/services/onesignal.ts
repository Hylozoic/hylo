import { AppState, type AppStateStatus } from 'react-native'
import * as Sentry from '@sentry/react-native'
import { OneSignal } from 'react-native-onesignal'
import { ONESIGNAL_APP_ID } from 'config'
import useLinkingStore from '../navigation/linking/store'

let initialized = false

// Register OneSignal listeners once the app shell is ready.
export function setupOneSignal () {
  if (initialized || !ONESIGNAL_APP_ID) return () => {}

  OneSignal.initialize(ONESIGNAL_APP_ID)
  initialized = true

  const foregroundWillDisplayHandler = (event: { preventDefault: () => void, notification: unknown }) => {
    event.preventDefault()
    if (__DEV__) console.log('foreground notification received:', event.notification)
  }

  const notificationClickHandler = (event: {
    notification: {
      additionalData?: { path?: string }
      launchURL?: string
    }
  }) => {
    const path = event.notification.additionalData?.path
    const url = path ? `https://www.hylo.com${path}` : event.notification.launchURL
    Sentry.addBreadcrumb({ category: 'notification', message: 'Notification tapped', data: { url } })
    if (__DEV__) console.log('OneSignal notification tapped:', url)
    if (url) {
      useLinkingStore.getState().setInitialURL(url)
    }
  }

  OneSignal.Notifications.addEventListener('foregroundWillDisplay', foregroundWillDisplayHandler)
  OneSignal.Notifications.addEventListener('click', notificationClickHandler)

  let appState = AppState.currentState
  const appStateHandler = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      OneSignal.Notifications.clearAll()
    }
    appState = nextAppState
  })

  return () => {
    appStateHandler.remove()
    OneSignal.Notifications.removeEventListener('foregroundWillDisplay', foregroundWillDisplayHandler)
    OneSignal.Notifications.removeEventListener('click', notificationClickHandler)
  }
}
