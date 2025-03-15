import { gql } from 'urql'

export default gql`
  mutation LeaveProjectMutation ($id: ID) {
    leaveProject (id: $id) {
      success
    }
  }
`
