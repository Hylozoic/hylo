export const MODULE_NAME = 'SpaceJoinPage'
export const JOIN_SPACE = `${MODULE_NAME}/JOIN_SPACE`

/**
 * Join a space directly (no approval needed). Open and role-gated spaces, plus any space when
 * the user has Administration on the parent. For Restricted spaces without Administration use
 * createJoinRequest instead. Backend enforces parent-group membership and access checks.
 * @param spaceId {string} the space (child Group) to join
 */
export default function joinSpace (spaceId) {
  return {
    type: JOIN_SPACE,
    graphql: {
      query: `mutation ($spaceId: ID!) {
        joinSpace(spaceId: $spaceId) {
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
      variables: { spaceId }
    },
    meta: {
      extractModel: 'Membership',
      groupId: spaceId,
      optimistic: true
    }
  }
}
