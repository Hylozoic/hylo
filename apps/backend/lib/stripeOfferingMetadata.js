/**
 * Offering presentation fields (buy button label, sliding scale) live in `stripe_products.metadata`
 * so `access_grants` stays limited to access scope (groups, tracks, roles).
 */

const BUY_BUTTON_TEXT_MAX_LENGTH = 30

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function parseJsonObject (value) {
  if (value == null) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return { ...value }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * Split incoming accessGrants (from API / forms) into clean access_grants + metadata payload.
 *
 * @param {Record<string, unknown>|null|undefined} accessGrants
 * @returns {{ cleanAccessGrants: Record<string, unknown>, offeringMetadata: Record<string, unknown> }}
 */
function extractOfferingPresentationFields (accessGrants) {
  const ag = parseJsonObject(accessGrants)
  const meta = {}
  const clean = { ...ag }

  const trimmedButton = clean.buyButtonText != null ? String(clean.buyButtonText).trim() : ''
  if (trimmedButton) {
    meta.buyButtonText = trimmedButton.slice(0, BUY_BUTTON_TEXT_MAX_LENGTH)
  }
  delete clean.buyButtonText

  const slide = clean.slidingScale != null ? clean.slidingScale : clean.sliding_scale
  if (slide != null && typeof slide === 'object') {
    meta.slidingScale = slide
  }
  delete clean.slidingScale
  delete clean.sliding_scale

  return { cleanAccessGrants: clean, offeringMetadata: meta }
}

/**
 * Merge stored metadata back into a read model for GraphQL / clients (backward compatible).
 *
 * @param {import('bookshelf').Model} product - StripeProduct
 * @returns {Record<string, unknown>}
 */
function mergeAccessGrantsForPresentation (product) {
  const base = parseJsonObject(product.get('access_grants'))
  const meta = parseJsonObject(product.get('metadata'))
  const out = { ...base }
  if (meta.buyButtonText != null && String(meta.buyButtonText).trim() !== '') {
    out.buyButtonText = String(meta.buyButtonText).trim()
  }
  if (meta.slidingScale != null && typeof meta.slidingScale === 'object') {
    out.slidingScale = meta.slidingScale
  }
  return out
}

/**
 * Resolved buy button label for display.
 *
 * @param {import('bookshelf').Model} product - StripeProduct
 * @returns {string|null}
 */
function getBuyButtonTextFromOffering (product) {
  const meta = parseJsonObject(product.get('metadata'))
  if (meta.buyButtonText != null && String(meta.buyButtonText).trim() !== '') {
    return String(meta.buyButtonText).trim()
  }
  const ag = parseJsonObject(product.get('access_grants'))
  const text = ag.buyButtonText
  return (text != null && String(text).trim() !== '') ? String(text).trim() : null
}

/**
 * Sliding scale config for checkout (metadata first, then legacy access_grants).
 *
 * @param {import('bookshelf').Model} product - StripeProduct
 * @returns {Record<string, unknown>|null}
 */
function getSlidingScaleFromOffering (product) {
  const meta = parseJsonObject(product.get('metadata'))
  if (meta.slidingScale != null && typeof meta.slidingScale === 'object' && meta.slidingScale.enabled) {
    return meta.slidingScale
  }
  const ag = parseJsonObject(product.get('access_grants'))
  if (ag.slidingScale != null && typeof ag.slidingScale === 'object' && ag.slidingScale.enabled) {
    return ag.slidingScale
  }
  if (ag.sliding_scale != null && typeof ag.sliding_scale === 'object' && ag.sliding_scale.enabled) {
    return ag.sliding_scale
  }
  return null
}

module.exports = {
  BUY_BUTTON_TEXT_MAX_LENGTH,
  parseJsonObject,
  extractOfferingPresentationFields,
  mergeAccessGrantsForPresentation,
  getBuyButtonTextFromOffering,
  getSlidingScaleFromOffering
}
