import { DEACTIVATE_ME } from '../constants'

/**
 * Deactivate the current user's account. `reason` is the optional answer to
 * why they are leaving (see ACCOUNT_EXIT_REASONS on the server).
 */
export default function deactivateMe ({ reason } = {}) {
  return {
    type: DEACTIVATE_ME,
    graphql: {
      query: `mutation DeactivateMe ($reason: String) {
        deactivateMe(reason: $reason) {
          success
        }
      }`,
      variables: { reason: reason || null }
    }
  }
}
