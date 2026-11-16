// Helpers for the Support Hylo donation flow (#1754).
// Donations happen on Open Collective's hosted page (a redirect, not an embed):
// https://documentation.opencollective.com/collectives/raising-money/creating-custom-fundraising-urls

export const OPEN_COLLECTIVE_SLUG = 'hylo'
export const SUPPORT_THANKS_PATH = '/support/thanks'

export const SUPPORT_INTERVALS = ['oneTime', 'month', 'year']
export const SUPPORT_AMOUNT_PRESETS = [10, 25, 50, 100]

/**
 * The Open Collective donate URL with our presets.
 * `amount` is in whole currency units, `interval` is month/year (omitted for one-time),
 * `tag` is the opaque hylo-<token> tag from createSupportIntent, and `redirectUrl`
 * is where OC sends the contributor back (it appends orderIdV2 and status).
 */
export function buildDonateUrl ({ slug = OPEN_COLLECTIVE_SLUG, amount, interval, tag, redirectUrl }) {
  const url = new URL(`https://opencollective.com/${encodeURIComponent(slug)}/donate`)
  const value = Number(amount)
  if (value > 0) url.searchParams.set('amount', String(value))
  if (interval === 'month' || interval === 'year') url.searchParams.set('interval', interval)
  if (tag) url.searchParams.set('tags', tag)
  if (redirectUrl) url.searchParams.set('redirect', redirectUrl)
  return url.toString()
}

export function supportThanksUrl (origin = window.location.origin) {
  return `${origin}${SUPPORT_THANKS_PATH}`
}
