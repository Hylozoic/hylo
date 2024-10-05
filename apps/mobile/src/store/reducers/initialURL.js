import { SET_INITIAL_URL } from 'store/constants'

export const initialState = null

export default function initialURLReducer (state = initialState, action) {
  const { type, payload } = action

  switch (type) {
    case SET_INITIAL_URL: {
      return payload
    }
  }

  return state
}
