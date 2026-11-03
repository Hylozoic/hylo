// Redux GraphQL actions can resolve with an error or reject; treat both as failure
export async function runGraphql (dispatch, action, field) {
  const result = await dispatch(action)
  if (result?.error) throw result.payload || new Error('GraphQL error')
  return result?.payload?.data?.[field]
}

export function formatMoney (cents, currency = 'usd', language) {
  try {
    return new Intl.NumberFormat(language, { style: 'currency', currency: currency.toUpperCase() }).format((cents || 0) / 100)
  } catch (e) {
    return `${((cents || 0) / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

export function formatDate (date, language) {
  return date ? new Date(date).toLocaleDateString(language, { year: 'numeric', month: 'short', day: 'numeric' }) : ''
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
