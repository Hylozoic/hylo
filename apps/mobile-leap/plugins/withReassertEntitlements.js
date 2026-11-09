// Re-inject entitlements that onesignal-expo-plugin drops during prebuild.
//
// onesignal-expo-plugin uses withEntitlementsPlist but its merge does not
// preserve every key from app.config.ts ios.entitlements — specifically
// com.apple.developer.associated-domains gets silently dropped.
//
// This plugin runs last in the mod chain (register it last in the plugins array)
// and re-adds the missing keys by merging rather than replacing, so anything
// a future plugin contributes also survives.

const { withEntitlementsPlist } = require('expo/config-plugins')

const ASSERTED_ENTITLEMENTS = {
  'com.apple.developer.associated-domains': [
    'applinks:www.hylo.com',
    'applinks:staging.hylo.com',
    'applinks:hylo.com'
  ]
}

module.exports = function withReassertEntitlements (config) {
  return withEntitlementsPlist(config, (entitlementsConfig) => {
    const existing = entitlementsConfig.modResults

    for (const [key, value] of Object.entries(ASSERTED_ENTITLEMENTS)) {
      // If the key already exists (from a prior plugin or config), merge arrays.
      // If not, set it fresh.
      if (Array.isArray(value) && Array.isArray(existing[key])) {
        const existingSet = new Set(existing[key])
        for (const item of value) {
          existingSet.add(item)
        }
        existing[key] = [...existingSet]
      } else {
        // Object or scalar values — just set (covers the current use case)
        existing[key] = value
      }
    }

    return entitlementsConfig
  })
}