import { CHECK_INVITATION } from 'store/constants'

/**
 * Check if an invitation is valid and get group info for redirect
 * @param inviteCodes {{ invitationToken?: string, accessCode?: string }}
 * @returns {{ valid: boolean, groupId?: string, groupSlug?: string, groupName?: string, isSpace?: boolean, parentGroupSlug?: string, parentGroupName?: string, email?: string, groupRole?: { id: string, name: string, emoji?: string }, requiresApproval?: boolean, isMemberLink?: boolean, tryLater?: boolean, invitedBy?: { id: string, name: string, avatarUrl?: string } }}
 *   requiresApproval: a member's invitation or personal invite link to a group where a steward approves new people, so the person requests to join with it instead of joining
 *   isMemberLink: the code is a member's personal invite link rather than the group's join link
 *   tryLater: a member's invite link that can't be used until its daily allowance frees up
 *   invitedBy: who sent an email invitation (steward or member), or whose personal invite link it is; null for the group's own join link
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
            requiresApproval
            isMemberLink
            tryLater
            invitedBy {
              id
              name
              avatarUrl
            }
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
