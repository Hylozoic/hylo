import { CHECK_INVITATION } from 'store/constants'

/**
 * Check if an invitation is valid and get group info for redirect
 * @param inviteCodes {{ invitationToken?: string, accessCode?: string }}
 * @returns {{ valid: boolean, groupId?: string, groupSlug?: string, groupName?: string, isSpace?: boolean, parentGroupSlug?: string, parentGroupName?: string, email?: string, groupRole?: { id: string, name: string, emoji?: string }, grantAccess?: boolean }}
 *   grantAccess: false means the link only lets the person see the group; they still request to join
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
            groupId
            groupSlug
            groupName
            isSpace
            parentGroupSlug
            parentGroupName
            email
            groupRole {
              id
              name
              emoji
            }
            grantAccess
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
