import { HYLO_PRO } from 'config/featureFlags'
import { hasFeature } from 'store/models/Me'
import getMe from './getMe'

/**
 * Whether to offer Hylo Pro billing (the group Billing settings tab). Hylo staff (HYLO_ADMINS,
 * the people who can open Management) always see it, so they can try Pro in their own groups
 * while the HYLO_PRO flag hides it from everyone else. The flag only hides the web UI; the
 * backend's Pro mutations and Group.proBilling are not gated.
 */
export default function getHyloProEnabled (state) {
  return hasFeature(HYLO_PRO) || !!getMe(state)?.isAdmin
}
