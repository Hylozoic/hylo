import { JOIN_GROUP } from 'store/constants'

export default function joinGroup (groupId) {
  return {
    type: JOIN_GROUP,
    graphql: {
      query: `
        mutation ($groupId: ID) {
          joinGroup(groupId: $groupId) {
            id
            hasModeratorRole
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
              joinQuestionsAnsweredAt
              showJoinForm
            }
          }
        }
      `,
      variables: {
        groupId
      }
    },
    meta: {
      extractModel: 'Membership',
      groupId,
      optimistic: true
    }
  }
}
