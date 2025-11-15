import { gql } from 'urql'

export default gql`
  mutation JoinFundingRound($id: ID) {
    joinFundingRound(id: $id) {
      id
      isParticipating
      joinedAt
    }
  }
`

