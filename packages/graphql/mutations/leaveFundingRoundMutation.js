import { gql } from 'urql'

export default gql`
  mutation LeaveFundingRound($id: ID) {
    leaveFundingRound(id: $id) {
      id
      isParticipating
    }
  }
`

