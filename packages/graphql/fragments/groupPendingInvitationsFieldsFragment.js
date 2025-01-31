import { gql } from 'urql'

export default gql`
  fragment GroupPendingInvitationsFieldsFragment on Group {
    pendingInvitations {
      hasMore
      items {
        id
        email
        createdAt
        lastSentAt
      }
    }
  }
`
