import { gql } from '@urql/core'

export default gql`
  fragment DraftFieldsFragment on Draft {
    id
    type
    data
    navigateTo
    updatedAt
    group {
      id
      name
      slug
    }
    post {
      id
    }
  }
`
