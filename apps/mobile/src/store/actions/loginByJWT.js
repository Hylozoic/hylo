import { LOGIN_BY_JWT } from 'store/constants'

export default function loginByJWT (loginJWT) {
  return {
    type: LOGIN_BY_JWT,
    payload: {
      api: {
        method: 'POST',
        path: '/noo/login/jwt',
        headers: {
          Authorization: `Bearer ${loginJWT}`
        }
      }
    }
  }
}
