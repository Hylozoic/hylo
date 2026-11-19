import { assertProFeature } from '@hylo/shared'

/**
 * Whether a group has one Hylo Pro feature now, from the `proFeatures` the group query fetches
 * (`{ [key]: boolean }`, see packages/shared HyloProFeatures.js). `key` must be a registered
 * feature key: a typo throws, so a gate can't quietly hide a feature from everyone.
 *
 * Only a hint for the UI (show or explain an upgrade): the server checks the feature again on
 * every mutation that needs it (HyloProService.requireProFeature).
 */
export function hasProFeature (group, key) {
  assertProFeature(key)
  return !!group?.proFeatures?.[key]
}

export default function useProFeature (group, key) {
  return hasProFeature(group, key)
}
