import { gql } from 'urql'

export default gql`
  mutation JoinProjectMutation ($id: ID) {
    joinProject (id: $id) {
      success
    }
  }
`
