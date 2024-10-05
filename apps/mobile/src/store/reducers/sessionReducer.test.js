import sessionReducer from './sessionReducer'
import { LOGIN, SET_CURRENT_GROUP_SLUG } from 'store/constants'

describe('on LOGIN', () => {
  it('stores login email as default', () => {
    const action = {
      type: LOGIN,
      payload: { id: '7' },
      meta: {
        email: 'foo@bar.com'
      }
    }
    expect(sessionReducer(null, action)).toEqual({
      defaultLoginEmail: 'foo@bar.com'
    })
  })
})

describe('on SET_CURRENT_GROUP_SLUG', () => {
  it('returns the payload', () => {
    const state = {
    }
    const action = {
      type: SET_CURRENT_GROUP_SLUG,
      payload: 'test-current-group-slug'
    }
    expect(sessionReducer(state, action))
      .toMatchSnapshot()
  })
})
