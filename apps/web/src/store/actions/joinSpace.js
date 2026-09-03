export const MODULE_NAME = 'SpaceJoinPage'
export const JOIN_SPACE = `${MODULE_NAME}/JOIN_SPACE`

/**
 * Join a space directly (no approval needed). Open and role-gated spaces, plus any space when
 * the user has Administration on the parent. A valid accessCode or invitationToken pre-approves
 * Closed, Restricted, and role-gated spaces. For Restricted spaces without Administration or
 * an invite, use createJoinRequest instead. Backend enforces parent-group membership and access.
 * @param spaceId {string} the space (child Group) to join
 * @param accessCode {string} optional join-link access code
 * @param invitationToken {string} optional email-invite token
 */
export default function joinSpace (spaceId, accessCode, invitationToken) {
  return {
    type: JOIN_SPACE,
    graphql: {
      query: `mutation JoinSpace ($spaceId: ID!, $accessCode: String, $invitationToken: String) {
        joinSpace(spaceId: $spaceId, accessCode: $accessCode, invitationToken: $invitationToken) {
          id
          group {
            id
            name
            slug
            type
            parentId
            icon
            avatarUrl
            acceptedPostTypes
            allowInPublic
          }
          person {
            id
          }
          lastViewedAt
          settings {
            agreementsAcceptedAt
            digestFrequency
            joinQuestionsAnsweredAt
            postNotifications
            sendEmail
            sendPushNotifications
            showJoinForm
          }
        }
      }`,
      variables: { spaceId, accessCode, invitationToken }
    },
    meta: {
      extractModel: 'Membership',
      groupId: spaceId,
      optimistic: true
    }
  }
}
