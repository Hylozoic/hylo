import reducer, {
  setParticipants, setMessage, SET_PARTICIPANTS, REMOVE_PARTICIPANT, CREATE_MESSAGE, SET_MESSAGE
} from './NewMessage.store'

describe('reducer', () => {
  describe('on SET_MESSAGE', () => {
    const action = {
      type: SET_MESSAGE,
      payload: 'hithere'
    }

    it('sets the message', () => {
      const newState = reducer({}, action)
      expect(newState.message).toEqual(action.payload)
    })
  })

  describe('on CREATE_MESSAGE', () => {
    const action = {
      type: CREATE_MESSAGE
    }
    const state = {
      otherKey: 'set',
      message: 'yo'
    }
    it('clears the message state', () => {
      const newState = reducer(state, action)
      expect(newState).toEqual({
        ...state,
        message: ''
      })
    })
  })
})

describe('setMessage', () => {
  it('returns the action', () => {
    const message = 'hithere'
    const action = setMessage(message)
    expect(action.type).toEqual(SET_MESSAGE)
    expect(action.payload).toEqual(message)
  })
})
