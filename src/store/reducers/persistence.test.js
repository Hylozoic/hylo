import AsyncStorage from '@react-native-async-storage/async-storage'
import { persist } from './persistence'
import { LOGOUT } from '../../components/Login/actions'

jest.mock('react-native-fbsdk')
jest.mock('lodash', () => ({
  debounce: (fn, timeout) => fn
}))

it('returns unchanged state when action is LOGOUT', () => {
  // await asyncOperationOnAsyncStorage();

  const reducer = (state, action) => ({ foo: 'bar' })
  const state = {}
  const action = { type: LOGOUT }
  const newState = persist(reducer)(state, action)

  expect(newState).toEqual({ foo: 'bar' })
  expect(AsyncStorage.setItem).not.toBeCalled()
})
