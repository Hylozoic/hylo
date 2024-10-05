import { isEmpty } from 'lodash'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import Intercom from '@intercom/intercom-react-native'
import { LOGOUT } from 'store/constants'
import { clearSessionCookie } from 'util/session'

export default function logout () {
  return {
    type: LOGOUT,
    payload: {
      api: {
        path: '/noo/session',
        method: 'DELETE'
      }
    },
    meta: {
      then: async () => {
        try {
          clearSessionCookie()
          Intercom.logout()
          if (!isEmpty(await GoogleSignin.getCurrentUser())) {
            await GoogleSignin.signOut()
          }
        } catch (e) {
          console.log('ERROR on logout', e.message)
        }
      }
    }
  }
}
