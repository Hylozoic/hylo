import checkLoginBootstrapFanOutMiddleware from './checkLoginBootstrapFanOutMiddleware'
import { CHECK_LOGIN, FETCH_FOR_CURRENT_USER } from 'store/constants'

const extractModel = [{ getRoot: x => x.me, modelName: 'Me' }]

function createStore () {
  const dispatched = []
  return {
    dispatched,
    dispatch (action) {
      dispatched.push(action)
      return action
    },
    getState: () => ({})
  }
}

it('fans out FETCH_FOR_CURRENT_USER after combined CHECK_LOGIN resolves', async () => {
  const store = createStore()
  const next = jest.fn(action => action)
  const middleware = checkLoginBootstrapFanOutMiddleware(store)
  const run = middleware(next)

  const payload = { data: { me: { id: '1' } } }
  await run({
    type: CHECK_LOGIN,
    payload,
    meta: { fanOutFetchForCurrentUser: true, extractModel }
  })

  expect(store.dispatched).toHaveLength(1)
  expect(store.dispatched[0].type).toBe(FETCH_FOR_CURRENT_USER)
  expect(store.dispatched[0].payload).toBe(payload)
  expect(store.dispatched[0].meta.fromCheckLoginFanOut).toBe(true)
})

it('falls back to light checkLogin when combined CHECK_LOGIN promise rejects', async () => {
  const store = createStore()
  const lightCheckLogin = { type: CHECK_LOGIN, payload: { data: { me: { id: '2' } } } }
  store.dispatch = jest.fn(() => Promise.resolve(lightCheckLogin))

  const next = jest.fn(() => Promise.reject(new Error('MeQuery failed')))
  const middleware = checkLoginBootstrapFanOutMiddleware(store)
  const run = middleware(next)

  const result = await run({
    type: CHECK_LOGIN,
    payload: Promise.reject(new Error('MeQuery failed')),
    meta: { fanOutFetchForCurrentUser: true, fallbackToLightCheckLogin: true, extractModel }
  })

  expect(store.dispatch).toHaveBeenCalled()
  expect(result).toBe(lightCheckLogin)
})
