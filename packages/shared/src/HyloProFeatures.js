/**
 * Hylo Pro feature registry: the one list of what Hylo Pro can give a group (#1712).
 *
 * Pro is sold in bundles (tiers), but every feature is checked on its own: `group.hasPro()` only
 * says whether a group has Pro at all, and each feature gate asks for its own key, so a feature
 * can be added to a group outside its tier (or removed from one) by Hylo staff.
 *
 * To register a new feature:
 *   1. add one `{ key, tier }` entry below, with the lowest tier that includes it (a higher tier
 *      includes every lower tier's features)
 *   2. add a `Boolean` field of the same name to `type HyloProFeatures` in
 *      apps/backend/api/graphql/schema.graphql — a backend test fails until the two lists match
 *   3. gate on it: `await group.hasProFeature('<key>')` / `requireProFeature(group, '<key>')` on the
 *      backend, `useProFeature(group, '<key>')` on the web
 * Supporter perks (the badge, basic metrics) are NOT Pro features and don't belong here: they come
 * from supporting Hylo on Open Collective.
 */

// Lowest to highest. A group on a tier has every feature of that tier and of the tiers before it.
export const HYLO_PRO_TIERS = ['pro', 'pro_plus', 'custom']

export const HYLO_PRO_DEFAULT_TIER = 'pro'

export const HYLO_PRO_FEATURES = [
  // Pro
  { key: 'postAsGroup', tier: 'pro' },
  { key: 'adminsEditAdminPosts', tier: 'pro' },
  { key: 'advancedMetrics', tier: 'pro' },
  { key: 'largerUploads', tier: 'pro' },
  { key: 'advancedDashboard', tier: 'pro' },
  { key: 'designedViews', tier: 'pro' },
  { key: 'liveAudioVideo', tier: 'pro' },
  { key: 'simpleWhitelabel', tier: 'pro' },
  { key: 'groupThemes', tier: 'pro' },
  { key: 'groupAssistant', tier: 'pro' },
  { key: 'setupWizard', tier: 'pro' },
  { key: 'matchmaking', tier: 'pro' },
  // Pro Plus
  { key: 'largerAudioVideo', tier: 'pro_plus' },
  { key: 'recording', tier: 'pro_plus' },
  { key: 'transcriptions', tier: 'pro_plus' },
  { key: 'broadcast', tier: 'pro_plus' },
  { key: 'higherUploadLimits', tier: 'pro_plus' },
  { key: 'collaborativeDocuments', tier: 'pro_plus' },
  { key: 'aiWorkflows', tier: 'pro_plus' },
  { key: 'higherAiLimits', tier: 'pro_plus' },
  { key: 'lowerPlatformFee', tier: 'pro_plus' },
  { key: 'childGroupsIncluded', tier: 'pro_plus' },
  // Custom
  { key: 'customDomain', tier: 'custom' },
  { key: 'federation', tier: 'custom' },
  { key: 'singleSignOn', tier: 'custom' }
]

export const HYLO_PRO_FEATURE_KEYS = HYLO_PRO_FEATURES.map(feature => feature.key)

const TIER_OF = Object.fromEntries(HYLO_PRO_FEATURES.map(feature => [feature.key, feature.tier]))

export function isProTier (tier) {
  return HYLO_PRO_TIERS.includes(tier)
}

export function isProFeature (key) {
  return Object.prototype.hasOwnProperty.call(TIER_OF, key)
}

// The tier a feature is first included in; throws for an unregistered key so a typo fails loudly
export function tierOfProFeature (key) {
  assertProFeature(key)
  return TIER_OF[key]
}

export function assertProFeature (key) {
  if (!isProFeature(key)) throw new Error(`Unknown Hylo Pro feature: ${key}`)
}

export function assertProTier (tier) {
  if (!isProTier(tier)) throw new Error(`Unknown Hylo Pro tier: ${tier}`)
}

// Keys of every feature a tier includes (its own and every lower tier's), in registry order
export function featuresForTier (tier) {
  assertProTier(tier)
  const rank = HYLO_PRO_TIERS.indexOf(tier)
  return HYLO_PRO_FEATURES
    .filter(feature => HYLO_PRO_TIERS.indexOf(feature.tier) <= rank)
    .map(feature => feature.key)
}

export function tierIncludesProFeature (tier, key) {
  return featuresForTier(tier).includes(key)
}

// The higher of two tiers (either may be null/undefined, meaning "none")
export function higherProTier (a, b) {
  if (!a) return b || null
  if (!b) return a
  return HYLO_PRO_TIERS.indexOf(b) > HYLO_PRO_TIERS.indexOf(a) ? b : a
}

/**
 * The features a group gets from its entitlements, as `{ [key]: boolean }` over every registered
 * key. Each entitlement is a bundle: its tier's features, plus the keys its overrides set to true,
 * minus the keys they set to false. A group with several entitlements (say a subscription and a
 * grant) gets the union, so one entitlement's override can't take away what another gives.
 *
 * @param {Array<{ tier: string, features?: object|null }>} entitlements active entitlements only
 */
export function resolveProFeatures (entitlements = []) {
  const granted = new Set()
  for (const entitlement of entitlements) {
    const overrides = entitlement.features || {}
    for (const key of featuresForTier(entitlement.tier || HYLO_PRO_DEFAULT_TIER)) {
      if (overrides[key] !== false) granted.add(key)
    }
    for (const key of Object.keys(overrides)) {
      if (overrides[key] === true && isProFeature(key)) granted.add(key)
    }
  }
  return Object.fromEntries(HYLO_PRO_FEATURE_KEYS.map(key => [key, granted.has(key)]))
}

// `{ [key]: boolean }` with every registered feature off, for groups without Pro
export function noProFeatures () {
  return resolveProFeatures([])
}

/**
 * The overrides a staff choice of features means on top of a tier: keys ticked that the tier
 * doesn't include become `true`, keys of the tier left unticked become `false`. Everything that
 * matches the tier is left out, so the stored overrides only record the differences.
 *
 * @returns {object|null} `{ [key]: boolean }`, or null when the choice matches the tier exactly
 */
export function proFeatureOverrides (tier, chosenKeys = []) {
  const chosen = new Set(chosenKeys)
  const included = new Set(featuresForTier(tier))
  const overrides = {}
  for (const key of HYLO_PRO_FEATURE_KEYS) {
    if (chosen.has(key) && !included.has(key)) overrides[key] = true
    if (!chosen.has(key) && included.has(key)) overrides[key] = false
  }
  return Object.keys(overrides).length > 0 ? overrides : null
}
