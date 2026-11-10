import { HYLO_PRO } from 'config/featureFlags'
import { hasFeature } from 'store/models/Me'

/**
 * Whether to offer Hylo Pro billing (the group Billing settings tab). While the
 * HYLO_PRO flag is off the backend also refuses Pro Checkout and the billing portal.
 */
export default function getHyloProEnabled (state) {
  return hasFeature(HYLO_PRO)
}
