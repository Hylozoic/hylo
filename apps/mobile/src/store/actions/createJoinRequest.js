import { CREATE_JOIN_REQUEST } from 'store/constants'

export default function createJoinRequest (groupId, questionAnswers) {
  return {
    type: CREATE_JOIN_REQUEST,
    graphql: {
      query: `
        mutation ($groupId: ID, $questionAnswers: [QuestionAnswerInput]) {
          createJoinRequest(groupId: $groupId, questionAnswers: $questionAnswers) {
            request {
              id
              user {
                id
              }
              group {
                id
              }
              createdAt
              updatedAt
              status
            }
          }
        }
      `,
      variables: { groupId, questionAnswers }
    },
    meta: {
      groupId,
      optimistic: true
    }
  }
}
