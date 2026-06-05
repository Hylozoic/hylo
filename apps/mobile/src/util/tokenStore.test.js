import { saveTokens, refreshAndSaveTokens } from './tokenStore'
import { refreshTokens } from './authApi'

// The bug this guards against: on app reopen both the urql authExchange and the
// WebView session bridge tried to refresh independently, each spending the
// rotating refresh token. The second (now-consumed) use made oidc-provider
// revoke the whole grant, silently logging the user out. refreshAndSaveTokens
// must coalesce concurrent callers so the refresh token is spent exactly once.
jest.mock('./authApi', () => ({
  refreshTokens: jest.fn()
}))

describe('tokenStore.refreshAndSaveTokens', () => {
  beforeEach(() => {
    refreshTokens.mockReset()
  })

  it('coalesces concurrent refreshes into a single token spend', async () => {
    await saveTokens({ access_token: 'a1', refresh_token: 'r1', expires_in: 3600 })

    let resolveRefresh
    refreshTokens.mockImplementation(() => new Promise(resolve => { resolveRefresh = resolve }))

    // Two subsystems race to refresh at the same moment (the real-world trigger).
    const first = refreshAndSaveTokens()
    const second = refreshAndSaveTokens()

    resolveRefresh({ access_token: 'a2', refresh_token: 'r2', expires_in: 3600 })
    const [firstResult, secondResult] = await Promise.all([first, second])

    // The rotating refresh token is used exactly once, with the original value.
    expect(refreshTokens).toHaveBeenCalledTimes(1)
    expect(refreshTokens).toHaveBeenCalledWith('r1')
    // Both callers receive the same rotated pair.
    expect(firstResult.access_token).toBe('a2')
    expect(firstResult.refresh_token).toBe('r2')
    expect(secondResult).toEqual(firstResult)
  })

  it('starts a fresh refresh once the previous one has settled', async () => {
    await saveTokens({ access_token: 'a2', refresh_token: 'r2', expires_in: 3600 })
    refreshTokens.mockResolvedValue({ access_token: 'a3', refresh_token: 'r3', expires_in: 3600 })

    await refreshAndSaveTokens()
    await refreshAndSaveTokens()

    expect(refreshTokens).toHaveBeenCalledTimes(2)
  })
})
