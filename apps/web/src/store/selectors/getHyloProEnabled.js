import { HYLO_PRO } from 'config/featureFlags'
import { hasFeature } from 'store/models/Me'

/**
 * Whether to offer Hylo Pro billing (the group Billing settings tab). The HYLO_PRO
 * flag only hides the web UI; the backend's Pro mutations and Group.proBilling are not gated.
 */
export default function getHyloProEnabled (state) {
  return hasFeature(HYLO_PRO)
}
