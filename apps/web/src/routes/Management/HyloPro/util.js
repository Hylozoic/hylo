import { formatLocalizedDate } from 'util/dateFormat'

// Redux GraphQL actions can resolve with an error or reject; treat both as failure
export async function runGraphql (dispatch, action, field) {
  const result = await dispatch(action)
  if (result?.error) throw result.payload || new Error('GraphQL error')
  return result?.payload?.data?.[field]
}

// `locale` throughout is getRegionalLocale(i18n.language), so en-AU browsers get en-AU formatting
export function formatMoney (cents, currency = 'usd', locale) {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase() }).format((cents || 0) / 100)
  } catch (e) {
    return `${((cents || 0) / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

// e.g. "Nov 3, 2026" (en-US), "3 Nov 2026" (en-AU), "3. Nov. 2026" (de-DE)
export function formatDate (date, locale) {
  return (date && formatLocalizedDate(new Date(date), { style: 'medium', locale })) || ''
}

// A date with the time in the viewer's time zone, 12- or 24-hour per locale, e.g. "3 Nov 2026, 2:15 pm" (en-AU)
export function formatDateTime (date, locale) {
  return (date && formatLocalizedDate(new Date(date), { style: 'mediumDateTime', locale })) || ''
}

// A YYYY-MM-DD date input value as the end of that day in the viewer's time zone, or null
export function endOfDayIso (value) {
  if (!value) return null
  const date = new Date(`${value}T23:59:59`)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

// An ISO date as a YYYY-MM-DD date input value in the viewer's time zone
export function toDateInputValue (date) {
  if (!date) return ''
  const d = new Date(date)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
