import { isEmpty } from 'lodash/fp'
import { LOGOUT, SET_RETURN_TO_ON_AUTH_PATH } from 'store/constants'

export const initialState = null

export default function returnToOnAuthPathReducer (state = initialState, { type, payload }) {
  switch (type) {
    case SET_RETURN_TO_ON_AUTH_PATH: {
      return isEmpty(payload)
        ? null
        : payload
    }

    // Handles the case of the logout action firing and then NonAuthLayout capturing
    // the current auth'd URL as the `returnToOnAuthPath`. There may be a better way to handle
    // this, but this works for now.
    case LOGOUT: {
      return null
    }
  }

  return state
}
