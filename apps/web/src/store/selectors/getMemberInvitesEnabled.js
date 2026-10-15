import { MEMBER_INVITES } from 'config/featureFlags'
import { hasFeature } from 'store/models/Me'
import getMe from './getMe'

/**
 * Whether to offer member invitations ("Who can add new members?" and the
 * Invite Members responsibility). The web flag must be on and the server must
 * not report them unavailable, since it refuses the everyone and roles
 * policies while its own flag is off.
 */
export default function getMemberInvitesEnabled (state) {
  return hasFeature(MEMBER_INVITES) && getMe(state)?.memberInvitesEnabled !== false
}
