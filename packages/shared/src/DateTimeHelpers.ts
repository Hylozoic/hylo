import { DateTime, DateTimeUnit } from 'luxon'
import prettyDate from 'pretty-date'

export const getLocaleAsString = (locale : string ) : string => {
  switch (locale) {
    case 'en':
      return 'en-US'
    case 'es':
      return 'es'
    default:
      return 'en-US'
  }
}

export const dateTimeNow = (locale?: string) : DateTime => {
  return DateTime.now().setLocale(getLocaleAsString(locale || ''))
}

export interface ToDateTimeOptions {
  timezone?: string;
  locale?: string;
}

export const toDateTime = (
  dt: string | Date | DateTime | Object,
  options?: ToDateTimeOptions
): DateTime => {
  const { timezone, locale } = options || {};
  const zoneOption = { zone: timezone || DateTime.now().zoneName || 'UTC' }
  const _dt = dt instanceof DateTime
    ? dt
    : dt instanceof Date
      ? DateTime.fromJSDate(dt, zoneOption).setLocale(getLocaleAsString(locale || ''))
      : typeof dt === 'string'
        ? DateTime.fromISO(dt, zoneOption).setLocale(getLocaleAsString(locale || ''))
        : DateTime.fromObject(dt, zoneOption).setLocale(getLocaleAsString(locale || ''))
  if (_dt.invalidReason) {
    throw new Error(`Invalid date: ${_dt.invalidReason}`)
  }
  return _dt
}

const isSame = (
  dt1: string | Date | DateTime | Object,
  dt2: string | Date | DateTime | Object,
  unit: DateTimeUnit,
  locale?: string
): boolean => {
  const _dt1 = toDateTime(dt1, { locale })
  const _dt2 = toDateTime(dt2, { locale })
  return _dt1.hasSame(_dt2, unit)
}

export const rangeIncludesDate = (
  start: string | Date | DateTime | Object,
  date: string | Date | DateTime | Object,
  end: string | Date | DateTime | Object,
): boolean => {
  const _start = toDateTime(start)
  const _date = toDateTime(date)
  const _end = toDateTime(end)
  return _date.hasSame(_start, 'day')
    || _date.hasSame(_end, 'day')
    || (_start < _date && _date < _end)
}

export const inWeek = (
  start: string | Date | DateTime | Object,
  date: string | Date | DateTime | Object,
  end: string | Date | DateTime | Object
): boolean => {
  const _start = toDateTime(start)
  const _date = toDateTime(date)
  const _end = toDateTime(end)
  const weekStart = _date.startOf('week', { useLocaleWeeks: true })
  const weekEnd = _date.endOf('week', { useLocaleWeeks: true }).plus({ days: 1 })
  return _start < weekEnd && weekStart <= _end
}

export const isSameDay = (
  // TODO datetime: need to check if these dates already have locale set
  date1 : string | Date | DateTime | Object,
  date2 : string | Date | DateTime | Object
) : boolean => {
  return isSame(date1, date2, 'day')
}

export const isSameWeek = (
  date1 : string | Date | DateTime | Object,
  date2 : string | Date | DateTime | Object
) : boolean => {
  return isSame(date1, date2, 'week')
}

export const isSameMonth = (
  date1 : string | Date | DateTime | Object,
  date2 : string | Date | DateTime | Object
) : boolean => {
  return isSame(date1, date2, 'month')
}

export function humanDate (
  date: string | Date | DateTime | Object,
  short?: boolean,
  locale?: string
): string {
  const _date = toDateTime(date, { locale })
  let ret = _date.invalidReason ? '' : prettyDate.format(_date.toJSDate())

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
  start: string | Date | DateTime | Object,
  end: string | Date | DateTime | Object | boolean,
  returnAsObj?: boolean,
  timezone?: string,
  locale?: string
): string | { from: string, to: string } => {
  const _start = toDateTime(start, { timezone, locale })
  const _end = end ? toDateTime(end, { timezone, locale }) : null

  const now = dateTimeNow(locale)

  const isPastYear = _start.get('year') < now.get('year')
  const isSameDay = _end && _start.get('day') === _end.get('day') &&
                    _start.get('month') === _end.get('month') &&
                    _start.get('year') === _end.get('year')

  let to = ''
  let from = ''

  // Format the start date - only include year if it's in the past
  if (isPastYear) {
    from = _start.toFormat("ccc MMM d, yyyy '•' t")
  } else {
    from = _start.toFormat("ccc MMM d '•' t")
  }

  // Format the end date/time if provided
  if (_end) {
    if (isSameDay) {
      // If same day, only show the end time
      to = _end.toFormat('t')
    } else if (_end.get('year') < now.get('year')) {
      // If end date is in a past year, include the year
      to = _end.toFormat("MMM d, yyyy '•' t")
    } else {
      // Otherwise just month, day and time
      to = _end.toFormat("MMM d '•' t")
    }

    to = returnAsObj ? to : ' - ' + to
  }

  return returnAsObj ? { from, to } : from + to
}

export function isDateInTheFuture (
  // TODO datetime: need to check if this date already has locale set
  date: string | Date | DateTime | Object,
  locale?: string
): boolean {
  return toDateTime(date, { locale }) > dateTimeNow(locale)
}

/**
 * Returns the month name from a date string or Date object
 * @param {string|Date} date - Date string or Date object
 * @param {boolean} short - Whether to return short month name (e.g. 'Jan' vs 'January')
 * @param {string} timezone - Optional timezone (defaults to local timezone)
 * @param {string} locale - Optional locale for formatting
 * @returns {string} Month name
 */
export function getMonthFromDate (
  date: string | Date | DateTime | Object,
  short?: boolean,
  timezone?: string,
  locale?: string
): string {
  return toDateTime(date, { timezone, locale }).toFormat(short ? 'MMM' : 'MMMM')
}

/**
 * Returns the day number from a date string or Date object
 * @param {string|Date} date - Date string or Date object
 * @param {string} timezone - Optional timezone (defaults to local timezone)
 * @param {string} locale - Optional locale for formatting
 * @returns {number} Day of month (1-31)
 */
export function getDayFromDate (
  date: string | Date | DateTime | Object,
  timezone?: string,
): number {
  return toDateTime(date, { timezone }).day
}

/**
 * Returns the hour from a date string or Date object
 * @param {string|Date} date - Date string or Date object
 * @param {boolean} use24Hour - Whether to use 24-hour format (default: false)
 * @param {string} timezone - Optional timezone (defaults to local timezone)
 * @param {string} locale - Optional locale for formatting
 * @returns {string} Formatted hour (with AM/PM if use24Hour is false)
 */
export function getHourFromDate (
  date: string | Date | DateTime | Object,
  use24Hour?: boolean,
  timezone?: string
): string {
  return toDateTime(date, { timezone }).toFormat(use24Hour ? 'HH' : 'h a')
}
