// @jest-environment node
// This test file is intended to be run with Jest, which provides the describe, it, and expect globals.
import * as DateTimeHelpers from './DateTimeHelpers'
import { DateTime } from 'luxon'

describe('formatDatePair', () => {
  it('displays differences of dates', () => {
    const d1 = DateTime.fromMillis(1551908483315, {zone: 'Etc/GMT'}).set({month: 1, day: 1, hour: 18})
    const d2 = d1.set({hour: 21})
    const d3 = d2.set({day: 2})
    const d4 = d3.set({month: 2})
    const d5 = d4.set({year: 2050})

    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d2 })).toMatchSnapshot()
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d3 })).toMatchSnapshot()
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d4 })).toMatchSnapshot()
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d5 })).toMatchSnapshot()
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: '' })).toMatchSnapshot()
  })

  it('can accept a custom timezone', () => {
    const d1 = DateTime.fromMillis(1551908483315, {zone: 'Etc/GMT'}).set({month: 1, day: 1, hour: 18})
    const d2 = d1.set({hour: 21})
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d2, timezone: 'America/New_York' })).toMatchSnapshot()
  })

  it('supports skipTime parameter', () => {
    const d1 = DateTime.fromMillis(1551908483315, {zone: 'Etc/GMT'}).set({month: 1, day: 1, hour: 18})
    const d2 = d1.set({hour: 21})
    const d3 = d2.set({day: 2})
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d2, skipTime: true })).toMatchSnapshot()
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d3, skipTime: true })).toMatchSnapshot()
  })

  it('returns object when returnAsObj is true', () => {
    const d1 = DateTime.fromMillis(1551908483315, {zone: 'Etc/GMT'}).set({month: 1, day: 1, hour: 18})
    const d2 = d1.set({hour: 21})
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d2, returnAsObj: true })).toMatchSnapshot()
  })
})
  