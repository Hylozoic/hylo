import { DateTime } from 'luxon'
import { DateTimeHelpers } from '@hylo/shared'
import { getDateLocale } from './locale'

/**
 * Converts a value to Luxon DateTime using the user's Hylo locale setting.
 */
export function toUserDateTime (date, locale) {
  return DateTimeHelpers.toDateTime(date, { locale: locale ?? getDateLocale() })
}

/**
 * Formats a date using the user's Hylo locale (not the browser locale).
 * @param {string|Date|DateTime|Object} date
 * @param {{ style?: 'short'|'medium'|'long'|'monthYear'|'dayMonthYear'|'time'|'datetime'|'mediumDateTime', locale?: string }} options
 */
export function formatLocalizedDate (date, { style = 'short', locale } = {}) {
  if (!date) return null

  const dt = toUserDateTime(date, locale)
  if (dt.invalidReason) return null

  switch (style) {
    case 'short':
      return dt.toLocaleString(DateTime.DATE_SHORT)
    case 'medium':
      return dt.toLocaleString(DateTime.DATE_MED)
    case 'long':
      return dt.toLocaleString(DateTime.DATE_FULL)
    case 'monthYear':
      return dt.toLocaleString({ month: 'short', year: 'numeric' })
    case 'dayMonthYear':
      return dt.toLocaleString({ month: 'short', day: 'numeric', year: 'numeric' })
    case 'time':
      return dt.toFormat('t')
    case 'datetime':
      return dt.toLocaleString(DateTime.DATETIME_SHORT)
    case 'mediumDateTime':
      return dt.toLocaleString(DateTime.DATETIME_MED)
    default:
      return dt.toLocaleString(DateTime.DATE_SHORT)
  }
}

/**
 * Formats a start/end date range using the user's Hylo locale.
 */
export function formatLocalizedDateRange (start, end, { style = 'short', locale } = {}) {
  const from = formatLocalizedDate(start, { style, locale })
  const to = formatLocalizedDate(end, { style, locale })
  if (!from && !to) return null
  if (!to) return from
  if (!from) return to
  return `${from} - ${to}`
}

/** formatDatePair with the user's Hylo locale applied by default. */
export function formatUserDatePair (options = {}) {
  return DateTimeHelpers.formatDatePair({
    ...options,
    locale: options.locale ?? getDateLocale()
  })
}

/**
 * A YYYY-MM-DD date input value as an ISO timestamp for the end of that day in the viewer's time
 * zone (so "until 31 Dec" includes the 31st), or null when empty or invalid.
 */
export function endOfDayIso (value) {
  if (!value) return null
  const date = new Date(`${value}T23:59:59`)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

/** A date (ISO string or Date) as a YYYY-MM-DD date input value in the viewer's time zone, or '' */
export function toDateInputValue (date) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
