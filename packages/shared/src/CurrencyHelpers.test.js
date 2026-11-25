import { formatCurrencyAmount, minorUnitsPerMajor } from './CurrencyHelpers'

// Intl separates some amounts and symbols with (narrow) no-break spaces; normalize them for readability
const plain = text => text && text.replace(/\s/g, ' ')

describe('minorUnitsPerMajor', () => {
  it('is 100 for most currencies, 1 for zero-decimal and 1000 for three-decimal ones, in any case', () => {
    expect(minorUnitsPerMajor('usd')).toBe(100)
    expect(minorUnitsPerMajor('EUR')).toBe(100)
    expect(minorUnitsPerMajor('jpy')).toBe(1)
    expect(minorUnitsPerMajor('KWD')).toBe(1000)
    expect(minorUnitsPerMajor()).toBe(100)
    expect(minorUnitsPerMajor(null)).toBe(100)
  })
})

describe('formatCurrencyAmount', () => {
  it('formats US dollars per locale, naming US dollars where $ could mean another currency', () => {
    expect(formatCurrencyAmount(1833, 'usd', 'en-US')).toBe('$18.33')
    expect(formatCurrencyAmount(1833, 'USD', 'en-GB')).toBe('US$18.33')
    expect(plain(formatCurrencyAmount(1833, 'usd', 'de-DE'))).toBe('18,33 $')
    expect(formatCurrencyAmount(0, 'usd', 'en-US')).toBe('$0.00')
  })

  it('defaults to US dollars', () => {
    expect(formatCurrencyAmount(500, undefined, 'en-US')).toBe('$5.00')
  })

  it('formats euros for a German reader', () => {
    expect(plain(formatCurrencyAmount(1500, 'eur', 'de-DE'))).toBe('15,00 €')
  })

  it('treats zero-decimal currencies as whole units', () => {
    expect(formatCurrencyAmount(1500, 'jpy', 'en-US')).toBe('¥1,500')
  })

  it('treats three-decimal currencies as thousandths', () => {
    expect(plain(formatCurrencyAmount(1500, 'kwd', 'en-US'))).toBe('KWD 1.500')
  })

  it('can drop the decimals of whole amounts only', () => {
    expect(formatCurrencyAmount(6000, 'usd', 'en-US', { dropZeroFraction: true })).toBe('$60')
    expect(formatCurrencyAmount(6050, 'usd', 'en-US', { dropZeroFraction: true })).toBe('$60.50')
    expect(formatCurrencyAmount(6000, 'usd', 'en-US')).toBe('$60.00')
  })

  it('returns null when there is no amount', () => {
    expect(formatCurrencyAmount(null, 'usd', 'en-US')).toBeNull()
    expect(formatCurrencyAmount(undefined, 'usd', 'en-US')).toBeNull()
    expect(formatCurrencyAmount('', 'usd', 'en-US')).toBeNull()
    expect(formatCurrencyAmount(NaN, 'usd', 'en-US')).toBeNull()
    expect(formatCurrencyAmount('abc', 'usd', 'en-US')).toBeNull()
  })

  it('falls back to the amount and code for a currency Intl does not accept', () => {
    expect(formatCurrencyAmount(1833, 'nope', 'en-US')).toBe('18.33 NOPE')
    expect(formatCurrencyAmount(6000, 'nope', 'en-US', { dropZeroFraction: true })).toBe('60 NOPE')
  })
})
