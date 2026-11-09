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
 * @param {{ style?: 'short'|'medium'|'long'|'monthYear'|'dayMonthYear'|'time'|'datetime', locale?: string }} options
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
