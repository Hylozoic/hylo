import { gql } from 'urql'

export default gql`
  fragment GroupJoinQuestionsFieldsFragment on Group {
    joinQuestions {
      items {
        id
        questionId
        text
      }
    }
    suggestedSkills {
      items {
        id
        name
      }
    }
  }
`
