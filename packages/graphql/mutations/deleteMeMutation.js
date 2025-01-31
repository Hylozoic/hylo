import { gql } from 'urql'

export default gql`
  mutation DeleteMeMutation {
    deleteMe {
      success
    }
  }
`
