import { SET_RETURN_TO_ON_AUTH_PATH } from 'store/constants'

export default function setReturnToOnAuthPath (pathOrURL) {
  return {
    type: SET_RETURN_TO_ON_AUTH_PATH,
    payload: pathOrURL
  }
}
