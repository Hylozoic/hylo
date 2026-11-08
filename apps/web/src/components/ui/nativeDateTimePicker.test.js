import {
  applyDateInputValue,
  applyTimeInputValue,
  defaultPickerTime,
  prefersNativeDateTimePicker,
  subscribeToPointerChanges,
  toDateInputValue,
  toTimeInputValue
} from './nativeDateTimePicker'

function fakeWindow ({ coarse, anyFine }) {
  const listeners = []
  const mql = (query) => ({
    matches: query === '(pointer: coarse)' ? coarse : anyFine,
    addEventListener: jest.fn((type, cb) => listeners.push(cb)),
    removeEventListener: jest.fn()
  })
  return { matchMedia: jest.fn(mql), listeners }
}

describe('prefersNativeDateTimePicker', () => {
  it('is true for a touch-only device', () => {
    expect(prefersNativeDateTimePicker(fakeWindow({ coarse: true, anyFine: false }))).toBe(true)
  })

  it('is false when a mouse or trackpad is attached', () => {
    expect(prefersNativeDateTimePicker(fakeWindow({ coarse: true, anyFine: true }))).toBe(false)
    expect(prefersNativeDateTimePicker(fakeWindow({ coarse: false, anyFine: true }))).toBe(false)
  })

  it('is false without a window or matchMedia (SSR, old jsdom)', () => {
    expect(prefersNativeDateTimePicker(undefined)).toBe(false)
    expect(prefersNativeDateTimePicker({})).toBe(false)
  })

  it('is false in the jest environment (matchMedia never matches)', () => {
    expect(prefersNativeDateTimePicker()).toBe(false)
  })
})

describe('subscribeToPointerChanges', () => {
  it('listens to both queries and unsubscribes', () => {
    const win = fakeWindow({ coarse: true, anyFine: false })
    const callback = jest.fn()
    const unsubscribe = subscribeToPointerChanges(callback, win)
    expect(win.listeners).toHaveLength(2)
    win.listeners.forEach(listener => listener())
    expect(callback).toHaveBeenCalledTimes(2)
    unsubscribe()
    win.matchMedia.mock.results.forEach(({ value }) => {
      expect(value.removeEventListener).toHaveBeenCalledWith('change', callback)
    })
  })

  it('falls back to addListener and is a no-op without matchMedia', () => {
    const mql = { matches: false, addListener: jest.fn(), removeListener: jest.fn() }
    const unsubscribe = subscribeToPointerChanges(jest.fn(), { matchMedia: () => mql })
    expect(mql.addListener).toHaveBeenCalledTimes(2)
    unsubscribe()
    expect(mql.removeListener).toHaveBeenCalledTimes(2)
    expect(() => subscribeToPointerChanges(jest.fn(), undefined)()).not.toThrow()
  })
})

describe('input value formatting', () => {
  const date = new Date(2026, 0, 5, 9, 7, 3)

  it('formats wall-clock dates as input values', () => {
    expect(toDateInputValue(date)).toBe('2026-01-05')
    expect(toTimeInputValue(date)).toBe('09:07')
    expect(toTimeInputValue(date, { seconds: true })).toBe('09:07:03')
  })

  it('returns empty strings for empty or invalid dates', () => {
    expect(toDateInputValue(undefined)).toBe('')
    expect(toDateInputValue(null)).toBe('')
    expect(toDateInputValue(new Date('nope'))).toBe('')
    expect(toTimeInputValue(undefined)).toBe('')
  })
})

describe('applyDateInputValue', () => {
  it('changes only the date and keeps the time', () => {
    const current = new Date(2026, 9, 21, 14, 30)
    const next = applyDateInputValue(current, '2026-11-05')
    expect(next).toEqual(new Date(2026, 10, 5, 14, 30))
    expect(current).toEqual(new Date(2026, 9, 21, 14, 30)) // not mutated
  })

  it('uses the fallback time when there is no value yet', () => {
    const fallback = new Date(2026, 0, 1, 18, 0)
    expect(applyDateInputValue(undefined, '2026-03-02', fallback)).toEqual(new Date(2026, 2, 2, 18, 0))
  })

  it('returns null for empty or malformed values', () => {
    expect(applyDateInputValue(new Date(), '')).toBeNull()
    expect(applyDateInputValue(new Date(), 'not-a-date')).toBeNull()
  })
})

describe('applyTimeInputValue', () => {
  it('changes only the time and keeps the date', () => {
    const current = new Date(2026, 9, 21, 14, 30, 45)
    expect(applyTimeInputValue(current, '08:05')).toEqual(new Date(2026, 9, 21, 8, 5, 0))
  })

  it('reads seconds when the input has them', () => {
    expect(applyTimeInputValue(new Date(2026, 0, 1), '23:59:58')).toEqual(new Date(2026, 0, 1, 23, 59, 58))
  })

  it("uses today's date when there is no value yet", () => {
    const now = new Date(2026, 4, 6, 12, 0)
    expect(applyTimeInputValue(undefined, '07:15', now)).toEqual(new Date(2026, 4, 6, 7, 15))
  })

  it('returns null for empty or out-of-range values', () => {
    expect(applyTimeInputValue(new Date(), '')).toBeNull()
    expect(applyTimeInputValue(new Date(), '25:00')).toBeNull()
    expect(applyTimeInputValue(new Date(), '7pm')).toBeNull()
  })
})

describe('defaultPickerTime', () => {
  it('rounds down to the hour', () => {
    expect(defaultPickerTime(new Date(2026, 0, 1, 10, 42, 13, 5))).toEqual(new Date(2026, 0, 1, 10, 0, 0, 0))
  })
})
