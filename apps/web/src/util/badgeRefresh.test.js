import { FETCH_BADGE_COUNTS } from 'store/constants'

// Fresh throttle state for every test
function loadRefresh () {
  let refreshBadgeCounts
  jest.isolateModules(() => {
    refreshBadgeCounts = require('./badgeRefresh').refreshBadgeCounts
  })
  return refreshBadgeCounts
}

describe('refreshBadgeCounts', () => {
  it('fetches the badge counts', () => {
    const refreshBadgeCounts = loadRefresh()
    const dispatch = jest.fn()

    expect(refreshBadgeCounts(dispatch, 1000)).toBe(true)
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: FETCH_BADGE_COUNTS }))
  })

  it('refetches at most once per 30 seconds', () => {
    const refreshBadgeCounts = loadRefresh()
    const dispatch = jest.fn()

    expect(refreshBadgeCounts(dispatch, 1000)).toBe(true)
    expect(refreshBadgeCounts(dispatch, 1000 + 29 * 1000)).toBe(false)
    expect(dispatch).toHaveBeenCalledTimes(1)

    expect(refreshBadgeCounts(dispatch, 1000 + 30 * 1000)).toBe(true)
    expect(dispatch).toHaveBeenCalledTimes(2)
  })
})
