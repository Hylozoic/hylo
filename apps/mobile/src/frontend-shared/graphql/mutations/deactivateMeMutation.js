import { gql } from 'urql'

export default gql`
  mutation DeactivateMeMutation {
    deactivateMe {
      success
    }
  }
`
