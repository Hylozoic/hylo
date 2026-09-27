import { renderHook } from '@testing-library/react'
import { refreshBadgeCounts } from 'util/badgeRefresh'
import { CHECK_FOR_NEW_NOTIFICATIONS } from 'store/constants'
import useRefreshBadgesOnReturn from './useRefreshBadgesOnReturn'

const mockDispatch = jest.fn()

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch
}))

jest.mock('util/badgeRefresh', () => ({
  refreshBadgeCounts: jest.fn(() => true)
}))

let visibilityState = 'visible'
let now = 0

function setVisibility (state, at) {
  now = at
  visibilityState = state
  document.dispatchEvent(new Event('visibilitychange'))
}

const notificationChecks = () =>
  mockDispatch.mock.calls.filter(([action]) => action?.type === CHECK_FOR_NEW_NOTIFICATIONS).length

beforeAll(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibilityState })
})

beforeEach(() => {
  visibilityState = 'visible'
  now = 0
  jest.spyOn(Date, 'now').mockImplementation(() => now)
  mockDispatch.mockClear()
  refreshBadgeCounts.mockClear()
  refreshBadgeCounts.mockReturnValue(true)
})

afterEach(() => {
  Date.now.mockRestore()
})

it('only checks notifications after a short absence', () => {
  renderHook(() => useRefreshBadgesOnReturn())

  setVisibility('hidden', 1000)
  setVisibility('visible', 1000 + 10 * 1000)

  expect(refreshBadgeCounts).not.toHaveBeenCalled()
  expect(notificationChecks()).toBe(1)
})

it('refetches every group badge after more than a minute away', () => {
  renderHook(() => useRefreshBadgesOnReturn())

  setVisibility('hidden', 1000)
  setVisibility('visible', 1000 + 90 * 1000)

  expect(refreshBadgeCounts).toHaveBeenCalledWith(mockDispatch)
  expect(notificationChecks()).toBe(0)
})

it('falls back to the notification check when the badge refetch is throttled', () => {
  refreshBadgeCounts.mockReturnValue(false)
  renderHook(() => useRefreshBadgesOnReturn())

  setVisibility('hidden', 1000)
  setVisibility('visible', 1000 + 90 * 1000)

  expect(refreshBadgeCounts).toHaveBeenCalledTimes(1)
  expect(notificationChecks()).toBe(1)
})

it('stops listening when unmounted', () => {
  const { unmount } = renderHook(() => useRefreshBadgesOnReturn())
  unmount()

  setVisibility('hidden', 1000)
  setVisibility('visible', 1000 + 90 * 1000)

  expect(refreshBadgeCounts).not.toHaveBeenCalled()
  expect(mockDispatch).not.toHaveBeenCalled()
})
