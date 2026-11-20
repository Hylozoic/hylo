/**
 * Money formatting shared by the web and the backend. Amounts are in the currency's smallest unit,
 * as Stripe stores them (cents for USD).
 */

// Most currencies have 100 minor units; these have none (an amount of 1500 JPY is ¥1,500) and these
// have 1000. https://docs.stripe.com/currencies#zero-decimal
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
])
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND'])

function currencyCode (currency) {
  return String(currency || 'usd').toUpperCase()
}

/**
 * How many of the smallest unit make one of the currency (100 cents in a dollar, 1 for JPY).
 * @param {string} [currency='usd'] ISO currency code, any case
 * @returns {number}
 */
export function minorUnitsPerMajor (currency = 'usd') {
  const code = currencyCode(currency)
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 1
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 1000
  return 100
}

/**
 * An amount in the currency's smallest unit, formatted for display in `locale`:
 * formatCurrencyAmount(1500, 'usd', 'en-US') is "$15.00", formatCurrencyAmount(1500, 'eur', 'de-DE')
 * is "15,00 €" and formatCurrencyAmount(1500, 'jpy', 'en-US') is "¥1,500". The caller passes the
 * locale (on the web, getDateLocale(): the user's Hylo language setting, never the browser's).
 *
 * @param {number} amount amount in the smallest currency unit
 * @param {string} [currency='usd'] ISO currency code, any case
 * @param {string} [locale] BCP 47 locale; the runtime's default when omitted
 * @param {{ dropZeroFraction?: boolean }} [options] dropZeroFraction: show whole amounts without
 *   decimals ("$60" rather than "$60.00")
 * @returns {string|null} null when there is no amount
 */
export function formatCurrencyAmount (amount, currency = 'usd', locale, { dropZeroFraction = false } = {}) {
  if (amount === null || amount === undefined || amount === '' || isNaN(Number(amount))) return null
  const code = currencyCode(currency)
  const perMajor = minorUnitsPerMajor(code)
  const value = Number(amount) / perMajor
  const fractionDigits = Math.round(Math.log10(perMajor))
  const digits = dropZeroFraction && Number.isInteger(value) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}

  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code, ...digits }).format(value)
  } catch (error) {
    // An unknown currency code or locale: still show the amount, with the code after it
    return `${value.toFixed(digits.maximumFractionDigits ?? fractionDigits)} ${code}`
  }
}
