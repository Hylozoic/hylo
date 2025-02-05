import { gql } from 'urql'

export default gql`
  mutation CreateJoinRequestMutation ($groupId: ID, $questionAnswers: [QuestionAnswerInput]) {
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
`
