import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const EMPTY = '—'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/
// A whole value that is a date: 'YYYY-MM-DD' or a full ISO timestamp, nothing else around it
const STRICT_ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

export function isNumber (value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isIsoDate (value) {
  return typeof value === 'string' && ISO_DATE.test(value)
}

// True only when the whole string is a date (so phrases like '2026-03-01 to 2026-03-27' stay verbatim)
export function isStrictIsoDate (value) {
  return typeof value === 'string' && STRICT_ISO_DATE.test(value.trim())
}

// True when every label is an ISO date on the first of a month (monthly cohorts)
export function isMonthlyLabels (labels) {
  return labels.length > 0 && labels.every(label => isIsoDate(label) && label.slice(8, 10) === '01')
}

// Parses 'YYYY-MM-DD' (or a full ISO timestamp) as a UTC calendar date
function parseIsoDate (value) {
  if (!isIsoDate(value)) return null
  const date = value.length === 10 ? new Date(`${value}T00:00:00Z`) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function numberFormat (locale, options) {
  try {
    return new Intl.NumberFormat(locale || undefined, options)
  } catch (e) {
    return new Intl.NumberFormat('en-US', options)
  }
}

function dateFormat (locale, options) {
  const opts = { timeZone: 'UTC', ...options }
  try {
    return new Intl.DateTimeFormat(locale || undefined, opts)
  } catch (e) {
    return new Intl.DateTimeFormat('en-US', opts)
  }
}

// Plain number with thousands separators; integers stay whole, fractional counts get one decimal
function formatCount (value, locale) {
  if (!isNumber(value)) return EMPTY
  const decimals = Number.isInteger(value) ? 0 : 1
  return numberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
}

// 0.534 → '53.4%'
function formatPercent (value, locale) {
  if (!isNumber(value)) return EMPTY
  return `${numberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value * 100)}%`
}

function formatRatio (value, locale) {
  if (!isNumber(value)) return EMPTY
  return numberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function formatOneDecimal (value, locale) {
  return numberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)
}

const identityT = (str, params) => {
  if (!params) return str
  return Object.entries(params).reduce((acc, [key, value]) => acc.replace(`{{${key}}}`, value), str)
}

/**
 * Formats a metric value by its unit. `t` translates the unit words ('hours', 'days').
 */
export function formatValue (value, unit, { t = identityT, locale } = {}) {
  if (value === null || value === undefined) return EMPTY
  if (typeof value === 'string') return value
  if (!isNumber(value)) return EMPTY
  switch (unit) {
    case 'percent':
      return formatPercent(value, locale)
    case 'ratio':
      return formatRatio(value, locale)
    case 'hours':
      return t('{{value}} hours', { value: formatOneDecimal(value, locale) })
    case 'days':
      return t('{{value}} days', { value: formatOneDecimal(value, locale) })
    default:
      return formatCount(value, locale)
  }
}

/**
 * Formats the difference between two values. Percent changes are in percentage points.
 */
export function formatChange (delta, unit, { t = identityT, locale } = {}) {
  if (!isNumber(delta)) return EMPTY
  const magnitude = Math.abs(delta)
  switch (unit) {
    case 'percent':
      return t('{{value}} pts', { value: formatOneDecimal(magnitude * 100, locale) })
    case 'ratio':
      return formatRatio(magnitude, locale)
    case 'hours':
    case 'days':
      return formatValue(magnitude, unit, { t, locale })
    default:
      return formatCount(magnitude, locale)
  }
}

/**
 * Direction of a change and whether it is good, bad or neutral given the metric's goodDirection.
 */
export function changeTone (current, previous, goodDirection) {
  if (!isNumber(current) || !isNumber(previous)) return null
  const delta = current - previous
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  let tone = 'neutral'
  if (direction !== 'flat' && goodDirection !== 'neutral') {
    tone = direction === goodDirection ? 'good' : 'bad'
  }
  return { delta, direction, tone }
}

function formatDate (value, locale, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
  const date = value instanceof Date ? value : parseIsoDate(value)
  if (!date) return value == null ? EMPTY : String(value)
  return dateFormat(locale, options).format(date)
}

// Short bucket label for chart axes
function formatBucket (value, granularity, locale) {
  if (granularity === 'month') return formatDate(value, locale, { year: 'numeric', month: 'short' })
  return formatDate(value, locale, { year: 'numeric', month: 'short', day: 'numeric' })
}

// True when each x value of a series is the END of a trailing window rather than a bucket start
export function isWindowEnd (data) {
  return data?.xMeaning === 'window-end'
}

/**
 * Label for one x value of a series. Bucket starts use the bucket label ('Mar 16, 2026', 'Mar 2026');
 * window ends read 'to Mar 22, 2026', or '28 days to Mar 22, 2026' with `withWindow` and a known windowDays.
 */
export function formatPoint (value, data, { t = identityT, locale, withWindow = false } = {}) {
  if (!isWindowEnd(data)) return formatBucket(value, data?.granularity || 'week', locale)
  const date = formatDate(value, locale)
  if (withWindow && isNumber(data.windowDays) && data.windowDays > 0) {
    return t('{{days}} days to {{date}}', { days: data.windowDays, date })
  }
  return t('to {{date}}', { date })
}

// A moment in UTC with the zone named ('May 13, 2026, 12:01 AM UTC'), matching the UTC report dates
function formatDateTime (value, locale) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return EMPTY
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }
  return dateFormat(locale, options).format(date)
}

/**
 * Returns formatters bound to the current translation function and language.
 */
export function useFormat () {
  const { t, i18n } = useTranslation()
  const locale = i18n?.language
  return useMemo(() => ({
    t,
    locale,
    value: (value, unit) => formatValue(value, unit, { t, locale }),
    change: (delta, unit) => formatChange(delta, unit, { t, locale }),
    date: (value, options) => formatDate(value, locale, options),
    bucket: (value, granularity) => formatBucket(value, granularity, locale),
    point: (value, data, options = {}) => formatPoint(value, data, { t, locale, ...options }),
    dateTime: value => formatDateTime(value, locale)
  }), [t, locale])
}
