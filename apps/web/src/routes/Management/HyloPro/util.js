import { featuresForTier, proFeatureOverrides } from '@hylo/shared'
import { formatLocalizedDate } from 'util/dateFormat'

// Redux GraphQL actions can resolve with an error or reject; treat both as failure
export async function runGraphql (dispatch, action, field) {
  const result = await dispatch(action)
  if (result?.error) throw result.payload || new Error('GraphQL error')
  return result?.payload?.data?.[field]
}

// `locale` throughout is getDateLocale(): the user's Hylo language setting (never the browser), so
// English (US) dates are month-first and English (UK) and every other Hylo locale day-first
export function formatMoney (cents, currency = 'usd', locale) {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase() }).format((cents || 0) / 100)
  } catch (e) {
    return `${((cents || 0) / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

// e.g. "Nov 3, 2026" (en-US), "3 Nov 2026" (en-GB), "3. Nov. 2026" (de-DE)
export function formatDate (date, locale) {
  return (date && formatLocalizedDate(new Date(date), { style: 'medium', locale })) || ''
}

// A date with the time in the viewer's time zone, 12- or 24-hour per locale, e.g. "3 Nov 2026, 14:15" (en-GB)
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

// The overrides a tier and the features ticked mean, as the API's [{ key, enabled }] (empty when none)
export function overridesList (tier, chosen) {
  return Object.entries(proFeatureOverrides(tier, chosen) || {}).map(([key, enabled]) => ({ key, enabled }))
}

// The features a grant row gives (its tier's, plus/minus its overrides), as the keys to tick in TierFeatures
export function chosenForRow (row) {
  const chosen = new Set(featuresForTier(row.tier || 'pro'))
  for (const { key, enabled } of row.features || []) {
    if (enabled) chosen.add(key)
    else chosen.delete(key)
  }
  return [...chosen]
}
