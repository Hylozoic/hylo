import { getDateLocale } from './locale'

// Stripe amounts are in the currency's smallest unit. Most currencies have 100 of them,
// these have none (an amount of 1500 JPY is ¥1,500) and these have 1000.
// https://docs.stripe.com/currencies#zero-decimal
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
])
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND'])

/**
 * How many of the smallest unit make one of the currency (100 cents in a dollar).
 * @param {string} currency - ISO currency code, any case
 * @returns {number}
 */
export function minorUnitsPerMajor (currency = 'usd') {
  const code = String(currency || 'usd').toUpperCase()
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 1
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 1000
  return 100
}

/**
 * Formats an amount in the currency's smallest unit (as Stripe stores it) for display,
 * in the viewer's locale: formatPrice(1500, 'usd', 'en-US') is "$15.00",
 * formatPrice(1500, 'eur', 'de-DE') is "15,00 €" and formatPrice(1500, 'jpy', 'en-US') is "¥1,500".
 *
 * @param {number} cents - Amount in the smallest currency unit
 * @param {string} [currency='usd'] - ISO currency code, any case
 * @param {string} [locale] - BCP 47 locale; defaults to the user's Hylo locale
 * @returns {string|null} null when there is no amount
 */
export default function formatPrice (cents, currency = 'usd', locale) {
  if (cents === null || cents === undefined || cents === '' || isNaN(Number(cents))) return null
  const code = String(currency || 'usd').toUpperCase()
  const amount = Number(cents) / minorUnitsPerMajor(code)
  const displayLocale = locale || getDateLocale()

  try {
    return new Intl.NumberFormat(displayLocale, { style: 'currency', currency: code }).format(amount)
  } catch (error) {
    return `${amount.toFixed(minorUnitsPerMajor(code) === 1 ? 0 : 2)} ${code}`
  }
}
