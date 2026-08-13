import { useEffect, useRef } from 'react'
import { LogLevel, OneSignal } from 'react-native-onesignal'
import Intercom from '@intercom/intercom-react-native'
import { useMutation } from 'urql'
import { useTranslation } from 'react-i18next'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { normalizeLocaleToFull } from '@hylo/shared'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'
import { ONESIGNAL_APP_ID, INTERCOM_APP_ID } from 'config'
import { isDev } from '../config/sentry'
import mixpanel from '../services/mixpanel'
import { persistLocale } from '../i18n'

// Identify the logged-in user with push, support chat, and analytics SDKs.
export default function useBindPlatformUser () {
  const { i18n } = useTranslation()
  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)
  const boundUserId = useRef<string | null>(null)
  const [{ currentUser, fetching }] = useCurrentUser({ requestPolicy: 'cache-and-network' })

  useEffect(() => {
    if (fetching || !currentUser?.id || boundUserId.current === currentUser.id) return

    boundUserId.current = currentUser.id

    const accountLocale = currentUser?.settings?.locale
    const locale = normalizeLocaleToFull(accountLocale || i18n.language)
    i18n.changeLanguage(locale)
    persistLocale(locale)
    if (!accountLocale) {
      updateUserSettings({ changes: { settings: { locale } } })
    }

    ;(async () => {
      if (ONESIGNAL_APP_ID) {
        try {
          if (isDev) OneSignal.Debug.setLogLevel(LogLevel.Verbose)
          const permissionGranted = await OneSignal.Notifications.canRequestPermission()
          if (permissionGranted) await OneSignal.Notifications.requestPermission(true)
          OneSignal.login(currentUser.id)
        } catch (error) {
          console.warn('OneSignal user bind failed:', (error as Error).message)
        }
      }

      if (INTERCOM_APP_ID) {
        try {
          await Intercom.loginUserWithUserAttributes({
            userId: currentUser.id,
            name: currentUser.name,
            email: currentUser.email
          })
        } catch (error) {
          console.warn('Intercom user bind failed:', (error as Error).message)
        }
      }

      if (mixpanel) {
        mixpanel.identify(currentUser.id)
        mixpanel.getPeople().set({
          $name: currentUser.name,
          $email: currentUser.email,
          $location: currentUser.location
        })
      }
    })()
  }, [currentUser, fetching])
}
