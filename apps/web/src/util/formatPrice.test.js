import formatPrice, { minorUnitsPerMajor } from './formatPrice'

describe('formatPrice', () => {
  it('formats US dollars from cents', () => {
    expect(formatPrice(1500, 'usd', 'en-US')).toBe('$15.00')
    expect(formatPrice(123456, 'USD', 'en-US')).toBe('$1,234.56')
  })

  it('formats euros for the viewer\'s locale', () => {
    expect(formatPrice(1500, 'eur', 'de-DE')).toBe('15,00 €')
    expect(formatPrice(1500, 'eur', 'en-US')).toBe('€15.00')
  })

  it('formats yen, which has no minor unit, without dividing by 100', () => {
    expect(formatPrice(1500, 'jpy', 'en-US')).toBe('¥1,500')
    expect(minorUnitsPerMajor('jpy')).toBe(1)
  })

  it('formats zero and returns null when there is no amount', () => {
    expect(formatPrice(0, 'usd', 'en-US')).toBe('$0.00')
    expect(formatPrice(null, 'usd', 'en-US')).toBeNull()
    expect(formatPrice(undefined, 'usd', 'en-US')).toBeNull()
  })

  it('defaults to US dollars and the user\'s locale', () => {
    expect(formatPrice(250)).toBe('$2.50')
  })

  it('falls back to the amount and code for an unknown currency', () => {
    expect(formatPrice(1500, 'zzzz', 'en-US')).toBe('15.00 ZZZZ')
  })
})
