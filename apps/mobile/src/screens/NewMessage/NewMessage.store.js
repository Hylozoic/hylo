import { uniqueId } from 'lodash/fp'
import { AnalyticsEvents } from '@hylo/shared'
import findOrCreateThreadMutation from 'graphql/mutations/findOrCreateThreadMutation'
import createMessageMutation from 'graphql/mutations/createMessageMutation'

export const MODULE_NAME = 'NewMessage'
export const SET_MESSAGE = `${MODULE_NAME}/SET_MESSAGE`
export const CREATE_MESSAGE = `${MODULE_NAME}/CREATE_MESSAGE`
export const FIND_OR_CREATE_THREAD = `${MODULE_NAME}/FIND_OR_CREATE_THREAD`

export function findOrCreateThread (participantIds) {
  return {
    type: FIND_OR_CREATE_THREAD,
    graphql: {
      query: findOrCreateThreadMutation,
      variables: { participantIds }
    },
    meta: { extractModel: 'MessageThread' }
  }
}

export function createMessage (messageThreadId, text, forNewThread) {
  return {
    type: CREATE_MESSAGE,
    graphql: {
      query: createMessageMutation,
      variables: {
        messageThreadId,
        text
      }
    },
    meta: {
      optimistic: true,
      extractModel: 'Message',
      tempId: uniqueId(`messageThread${messageThreadId}_`),
      messageThreadId,
      text,
      forNewThread,
      analytics: AnalyticsEvents.DIRECT_MESSAGE_SENT
    }
  }
}

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
