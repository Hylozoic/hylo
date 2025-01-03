export const MODULE_NAME = 'MessageInput'
export const SET_MESSAGE = `${MODULE_NAME}/SET_MESSAGE`
export const CREATE_MESSAGE = `${MODULE_NAME}/CREATE_MESSAGE`

export const initialState = {
  message: ''
}

export default function reducer (state = initialState, action) {
  const { type, payload } = action
  switch (type) {
    case SET_MESSAGE:
      return {
        ...state,
        message: payload
      }
    case CREATE_MESSAGE:
      return {
        ...state,
        message: ''
      }
  }
  return state
}

export function setMessage (message) {
  return {
    type: SET_MESSAGE,
    payload: message
  }
}

export function getMessage (state) {
  return state[MODULE_NAME].message
}
