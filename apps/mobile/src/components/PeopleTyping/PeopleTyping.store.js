import { omit } from 'lodash/fp'

export const ADD_USER_TYPING = 'PeopleTyping/ADD_USER_TYPING'
export const CLEAR_USER_TYPING = 'PeopleTyping/CLEAR_USER_TYPING'

export default function reducer (state = {}, action) {
  const { error, type, payload } = action
  if (error) return state

  switch (type) {
    case ADD_USER_TYPING:
      return {
        ...state,
        [payload.id]: {
          name: payload.name,
          timestamp: Date.now()
        }
      }

    case CLEAR_USER_TYPING:
      return omit([payload.id], state)

    default:
      return state
  }
}

export function addUserTyping (id, name) {
  return {
    type: ADD_USER_TYPING,
    payload: { id, name }
  }
}

export function clearUserTyping (id) {
  return {
    type: CLEAR_USER_TYPING,
    payload: { id }
  }
}

export const getPeopleTyping = state => state.PeopleTyping
