import store from 'store/index'

jest.mock('react-native-onesignal', () => ({
  addEventListener: jest.fn()
}))
jest.mock('../util/session', () => ({
  setSessionCookie: jest.fn(() => Promise.resolve())
}))

describe('getStore', () => {
  it('works', () => {
    expect(store).toMatchSnapshot()
  })

  it('has api middleware', async () => {
    fetch.mockResponseSuccess({ message: 'ok' })

    const action = {
      type: 'TEST',
      payload: {
        api: { path: '/foo' }
      }
    }

    expect(await store.dispatch(action)).toEqual({
      type: 'TEST',
      payload: { message: 'ok' }
    })
  })

  it('has afterInteractions middleware', async () => {
    const action = {
      type: 'TEST',
      payload: 'hi',
      meta: {
        afterInteractions: true
      }
    }

    expect(await store.dispatch(action)).toEqual(action)
  })
})
