import { DELETE_ME } from '../constants'

/**
 * Delete the current user's account. `reason` is the optional answer to why
 * they are leaving (see ACCOUNT_EXIT_REASONS on the server).
 */
export default function deleteMe ({ reason } = {}) {
  return {
    type: DELETE_ME,
    graphql: {
      query: `mutation DeleteMe ($reason: String) {
        deleteMe(reason: $reason) {
          success
        }
      }`,
      variables: { reason: reason || null }
    }
  }
}
