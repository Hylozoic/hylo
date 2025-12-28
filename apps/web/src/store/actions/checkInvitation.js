import { CHECK_INVITATION } from 'store/constants'

/**
 * Check if an invitation is valid and get group info for redirect
 * @param inviteCodes {{ invitationToken?: string, accessCode?: string }}
 * @returns {{ valid: boolean, groupSlug?: string, email?: string }}
 */
export default function checkInvitation (inviteCodes) {
  const { invitationToken, accessCode } = inviteCodes
  return {
    type: CHECK_INVITATION,
    graphql: {
      query: `
        query CheckInvitation ($invitationToken: String, $accessCode: String) {
          checkInvitation (invitationToken: $invitationToken, accessCode: $accessCode) {
            valid
            groupSlug
            email
          }
        }
      `,
      variables: {
        invitationToken,
        accessCode
      }
    }
  }
}
