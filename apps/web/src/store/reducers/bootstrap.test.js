import bootstrap, { getInitialBootstrapState, MAX_CACHED_GROUPS } from './bootstrap'
import {
  CHECK_LOGIN,
  FETCH_FOR_CURRENT_USER,
  FETCH_FOR_GROUP,
  LOGOUT
} from 'store/constants'

describe('bootstrap reducer', () => {
  it('returns initial state', () => {
    expect(bootstrap(undefined, { type: '@@INIT' })).toEqual(getInitialBootstrapState())
  })

  it('captures CHECK_LOGIN payload', () => {
    const payload = { data: { me: { id: '1', name: 'Ada' } } }
    const next = bootstrap(getInitialBootstrapState(), { type: CHECK_LOGIN, payload })
    expect(next.checkLogin.data).toEqual(payload.data)
    expect(next.checkLogin.at).toEqual(expect.any(Number))
  })

  it('captures FETCH_FOR_CURRENT_USER payload', () => {
    const payload = { data: { me: { id: '1', memberships: [] } } }
    const next = bootstrap(getInitialBootstrapState(), { type: FETCH_FOR_CURRENT_USER, payload })
    expect(next.currentUser.data).toEqual(payload.data)
  })

  it('captures FETCH_FOR_GROUP payload keyed by slug', () => {
    const payload = { data: { group: { id: '10', slug: 'hylo' } } }
    const next = bootstrap(getInitialBootstrapState(), {
      type: FETCH_FOR_GROUP,
      payload,
      meta: { slug: 'hylo' }
    })
    expect(next.groupsBySlug.hylo.data).toEqual(payload.data)
  })

  it('LRU-trims groupsBySlug', () => {
    let state = getInitialBootstrapState()
    for (let i = 0; i < MAX_CACHED_GROUPS + 2; i++) {
      state = bootstrap(state, {
        type: FETCH_FOR_GROUP,
        payload: { data: { group: { id: String(i), slug: `g-${i}` } } },
        meta: { slug: `g-${i}` }
      })
      state.groupsBySlug[`g-${i}`].at = i
    }

    expect(Object.keys(state.groupsBySlug)).toHaveLength(MAX_CACHED_GROUPS)
    expect(state.groupsBySlug['g-0']).toBeUndefined()
    expect(state.groupsBySlug[`g-${MAX_CACHED_GROUPS + 1}`]).toBeDefined()
  })

  it('clears on LOGOUT', () => {
    const populated = bootstrap(getInitialBootstrapState(), {
      type: FETCH_FOR_CURRENT_USER,
      payload: { data: { me: { id: '1' } } }
    })
    expect(bootstrap(populated, { type: LOGOUT })).toEqual(getInitialBootstrapState())
  })

  it('ignores errored actions', () => {
    const state = bootstrap(getInitialBootstrapState(), {
      type: CHECK_LOGIN,
      error: true,
      payload: { data: { me: { id: '1' } } }
    })
    expect(state.checkLogin).toBeNull()
  })
})
