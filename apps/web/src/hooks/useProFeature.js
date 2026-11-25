import { assertProFeature } from '@hylo/shared'

// Hylo Pro states in which Pro features work (the server decides the state: HyloProSubscription.proState).
// 'grace' is a failed payment within its grace period; in 'lapsed' and 'none' every feature is off, and
// what a group made with Pro stays but can't be changed with Pro features.
export const PRO_FEATURE_STATES = ['active', 'grace']

/**
 * Whether a group has one Hylo Pro feature now, from the `proFeatures` the group query fetches
 * (`{ [key]: boolean }`, see packages/shared HyloProFeatures.js) and its `proState`. `key` must be a
 * registered feature key: a typo throws, so a gate can't quietly hide a feature from everyone.
 *
 * Only a hint for the UI (show or explain an upgrade): the server checks the feature again on
 * every mutation that needs it (HyloProService.requireProFeature).
 */
export function hasProFeature (group, key) {
  assertProFeature(key)
  // proFeatures already follows the state; this keeps a stale copy from outliving a lapse
  if (group?.proState && !PRO_FEATURE_STATES.includes(group.proState)) return false
  return !!group?.proFeatures?.[key]
}

export default function useProFeature (group, key) {
  return hasProFeature(group, key)
}
