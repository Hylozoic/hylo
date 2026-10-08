import { LOGIN_BY_TOKEN } from 'store/constants'

export default function loginByToken (userID, loginToken) {
  return {
    type: LOGIN_BY_TOKEN,
    payload: {
      api: {
        method: 'POST',
        path: '/noo/login/token',
        params: {
          u: userID,
          t: loginToken
        }
      }
    }
  }
}
