import { LOGIN_WITH_APPLE, LOGIN_WITH_FACEBOOK, LOGIN_WITH_GOOGLE } from 'components/SocialAuth/actions'
import { LOGIN, LOGIN_BY_TOKEN } from 'store/constants'

export const initialState = {
  defaultLoginEmail: null,
  initialURLHandled: false
}

export default function sessionReducer (state = initialState, action) {
  const { type, meta } = action

  switch (type) {
    case LOGIN:
    case LOGIN_BY_TOKEN:
    case LOGIN_WITH_APPLE:
    case LOGIN_WITH_FACEBOOK:
    case LOGIN_WITH_GOOGLE: {
      return {
        // TODO: don't we need to keep existing state, e.g. ...state?
        defaultLoginEmail: meta?.email
      }
    }
  }

  return state
}
