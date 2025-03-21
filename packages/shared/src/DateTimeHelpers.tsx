import { DateTime, DateTimeUnit } from 'luxon'
import { localeLocalStorageSync } from '../../../apps/web/src/util/locale'
import prettyDate from 'pretty-date'

export const getLocaleAsString = () : string => {
  switch (localeLocalStorageSync()) {
    case 'en':
      return 'en-US'
    case 'es':
      return 'es'
    default:
      return 'en-US'
  }
}

export const dateTimeNow = () : DateTime => {
  return DateTime.now().setLocale(getLocaleAsString())
}

export const toDateTime = (
  dt : string | Date | DateTime | Object,
  timezone? : string
) : DateTime => {
  const zoneOption = { zone: timezone || DateTime.now().zoneName || 'UTC' }
  const _dt = dt instanceof DateTime
    ? dt
    : dt instanceof Date
      ? DateTime.fromJSDate(dt, zoneOption).setLocale(getLocaleAsString())
      : typeof dt === 'string'
        ? DateTime.fromISO(dt, zoneOption).setLocale(getLocaleAsString())
        : DateTime.fromObject(dt, zoneOption).setLocale(getLocaleAsString())
  if (_dt.invalidReason) {
    throw new Error(`Invalid date: ${_dt.invalidReason}`)
  }
  return _dt
}

const same = (
  dt1 : string | Date | DateTime | Object,
  dt2 : string | Date | DateTime | Object,
  unit : DateTimeUnit
) : boolean => {
  const _dt1 = toDateTime(dt1)
  const _dt2 = toDateTime(dt2)
  return _dt1.hasSame(_dt2, unit)
}

export const includes = (
  dt1 : string | Date | DateTime | Object,
  dt2 : string | Date | DateTime | Object,
  dt3 : string | Date | DateTime | Object
) : boolean => {
  const _dt1 = toDateTime(dt1)
  const _dt2 = toDateTime(dt2)
  const _dt3 = toDateTime(dt3)
  return _dt2.hasSame(_dt1, 'day')
    || _dt2.hasSame(_dt3, 'day')
    || (_dt1 <= _dt2 && _dt2 < _dt3)
}

export const inWeek = (
  dt1 : string | Date | DateTime | Object,
  dt2 : string | Date | DateTime | Object,
  dt3 : string | Date | DateTime | Object
) : boolean => {
  const _dt1 = toDateTime(dt1)
  const _dt2 = toDateTime(dt2)
  const _dt3 = toDateTime(dt3)
  const weekStart = _dt2.startOf('week', { useLocaleWeeks: true })
  const weekEnd = _dt2.endOf('week', { useLocaleWeeks: true }).plus({ days: 1 })
  return _dt1 < weekEnd && weekStart <= _dt3
}

export const sameDay = (
  dt1 : string | Date | DateTime | Object,
  dt2 : string | Date | DateTime | Object,
  dt3? : string | Date | DateTime | Object
) : boolean => {
  return dt3 ? includes(dt1, dt2, dt3) : same(dt1, dt2, 'day')
}

export const sameWeek = (
  dt1 : string | Date | DateTime | Object,
  dt2 : string | Date | DateTime | Object
) : boolean => {
  return same(dt1, dt2, 'week')
}

export const sameMonth = (
  dt1 : string | Date | DateTime | Object,
  dt2 : string | Date | DateTime | Object
) : boolean => {
  return same(dt1, dt2, 'month')
}

export function humanDate (
  dt : string | Date | DateTime | Object,
  short? : boolean
) : string {
  const _dt = toDateTime(dt)
  let ret = _dt.invalidReason ? '' : prettyDate.format(_dt.toJSDate())

  // Always return 'now' for very recent timestamps
  if (ret === 'just now') {
    return 'now'
  }

  if (short) {
    ret = ret.replace(' ago', '')
  } else {
    if (ret.match(/(\d+) seconds? ago/)) {
      return 'now'
    }
  }

  return ret.replace(/ seconds?/, 's')
    .replace(/ minutes?/, 'm')
    .replace(/ hours?/, 'h')
    .replace(/ days?/, 'd')
    .replace(/ weeks?/, 'w')
    .replace(/ years?/, 'y')
    .replace(/ month(s?)/, ' mo$1')
}

export const formatDatePair = (
  startTime : string | Date | DateTime | Object,
  endTime : string | Date | DateTime | Object | boolean,
  returnAsObj? : boolean,
  timezone? : string
) : string | { from : string, to : string } => {
  const start = toDateTime(startTime, timezone)
  const end = endTime ? toDateTime(endTime, timezone) : null

  const now = dateTimeNow()

  const isPastYear = start.get('year') < now.get('year')
  const isSameDay = end && start.get('day') === end.get('day') &&
                    start.get('month') === end.get('month') &&
                    start.get('year') === end.get('year')

  let to = ''
  let from = ''

  // Format the start date - only include year if it's in the past
  if (isPastYear) {
    from = start.toFormat("ccc MMM d, yyyy '•' t")
  } else {
    from = start.toFormat("ccc MMM d '•' t")
  }

  // Format the end date/time if provided
  if (endTime) {
    if (isSameDay) {
      // If same day, only show the end time
      to = end.toFormat('t')
    } else if (end.get('year') < now.get('year')) {
      // If end date is in a past year, include the year
      to = end.toFormat("MMM d, yyyy '•' t")
    } else {
      // Otherwise just month, day and time
      to = end.toFormat("MMM d '•' t")
    }

    to = returnAsObj ? to : ' - ' + to
  }

  return returnAsObj ? { from, to } : from + to
}

export function isDateInTheFuture (
  date : string | Date | DateTime | Object
) : boolean {
  return toDateTime(date) > dateTimeNow()
}

/**
 * Returns the month name from a date string or Date object
 * @param {string|Date} date - Date string or Date object
 * @param {boolean} short - Whether to return short month name (e.g. 'Jan' vs 'January')
 * @param {string} timezone - Optional timezone (defaults to local timezone)
 * @returns {string} Month name
 */
export function getMonthFromDate (
  date : string | Date | DateTime | Object,
  short? : boolean,
  timezone? : string
) : string {
  return toDateTime(date, timezone).toFormat(short ? 'MMM' : 'MMMM')
}

/**
 * Returns the day number from a date string or Date object
 * @param {string|Date} date - Date string or Date object
 * @param {string} timezone - Optional timezone (defaults to local timezone)
 * @returns {number} Day of month (1-31)
 */
export function getDayFromDate (
  date : string | Date | DateTime | Object,
  timezone? : string
) : number {
  return toDateTime(date, timezone).day
}

/**
 * Returns the hour from a date string or Date object
 * @param {string|Date} date - Date string or Date object
 * @param {boolean} use24Hour - Whether to use 24-hour format (default: false)
 * @param {string} timezone - Optional timezone (defaults to local timezone)
 * @returns {string} Formatted hour (with AM/PM if use24Hour is false)
 */
export function getHourFromDate (
  date : string | Date | DateTime | Object,
  use24Hour? : boolean,
  timezone? : string
) : string {
  return toDateTime(date, timezone).toFormat(use24Hour ? 'HH' : 'h a')
}
