export const MODULE_NAME = 'SpaceJoinPage'
export const JOIN_SPACE = `${MODULE_NAME}/JOIN_SPACE`

/**
 * Join an Open space directly (no approval needed). For Restricted spaces use
 * createJoinRequest instead. Backend enforces parent-group membership and required-role checks.
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
