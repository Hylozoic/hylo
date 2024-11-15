import { gql } from 'urql'

export default gql`
  query PlatformAgreementsQuery {
    platformAgreements {
      id
      text
      type
    }
  }
`
