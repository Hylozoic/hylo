import reducer, {
  ADD_USER_TYPING,
  CLEAR_USER_TYPING,
  addUserTyping,
  clearUserTyping
} from './PeopleTyping.store'
import { omit } from 'lodash'

describe('reducer', () => {
  it('adds data for ADD_USER_TYPING', () => {
    const action = {
      type: ADD_USER_TYPING,
      payload: { id: '1', name: 'Proteus' }
    }
    const newState = reducer({}, action)
    expect(newState).toEqual({
      1: {
        name: 'Proteus',
        timestamp: expect.any(Number)
      }
    })
    expect(Date.now() - newState['1'].timestamp).toBeLessThan(100)
  })

  it('removes data for CLEAR_USER_TYPING', () => {
    const action = {
      type: CLEAR_USER_TYPING,
      payload: { id: '5' }
    }

    const state = {
      1: {
        name: 'Proteus',
        timestamp: Date.now()
      },
      5: {
        name: 'Lydia',
        timestamp: Date.now()
      }
    }

    expect(reducer(state, action)).toEqual(omit(state, '5'))
  })
})

describe('action creators', () => {
  it('matches the last snapshot for addUserTyping', () => {
    expect(addUserTyping('1', 'Proteus')).toMatchSnapshot()
  })

  it('matches the last snapshot for clearUserTyping', () => {
    expect(clearUserTyping('1')).toMatchSnapshot()
  })
})
