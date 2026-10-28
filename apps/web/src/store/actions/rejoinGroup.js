export const MODULE_NAME = 'RejoinGroup'
export const REJOIN_GROUP = `${MODULE_NAME}/REJOIN_GROUP`

/** Reactivates a prior paid-group or space membership when its access scope remains valid. */
export default function rejoinGroup (groupId) {
  return {
    type: REJOIN_GROUP,
    graphql: {
      query: `mutation RejoinGroup ($groupId: ID!) {
        rejoinGroup(groupId: $groupId) {
          id
          groupId
          group {
            id
            name
            slug
            type
            parentId
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
      variables: { groupId }
    },
    meta: {
      extractModel: 'Membership',
      groupId
    }
  }
}
