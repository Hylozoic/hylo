import { GoogleSignin } from '@react-native-google-signin/google-signin'
import Intercom from '@intercom/intercom-react-native'
import { OneSignal } from 'react-native-onesignal'
import { ONESIGNAL_APP_ID, INTERCOM_APP_ID } from 'config'
import mixpanel from './mixpanel'
import { clearSessionCookie } from 'util/session'

// Tear down third-party sessions and the WebView cookie jar on logout.
export async function logoutServices () {
  try {
    await clearSessionCookie()
    if (ONESIGNAL_APP_ID) OneSignal.logout()
    if (INTERCOM_APP_ID) Intercom.logout()
    mixpanel?.flush()
    mixpanel?.reset()

    if (await GoogleSignin.isSignedIn()) {
      await GoogleSignin.signOut()
    }
  } catch (error) {
    console.warn('Error during logout services:', (error as Error).message)
  }
}
