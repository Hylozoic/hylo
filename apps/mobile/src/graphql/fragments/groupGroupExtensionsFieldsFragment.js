import { gql } from 'urql'

export default gql`
  fragment GroupGroupExtensionsFieldsFragment on Group {
    groupExtensions {
      items {
        id
        data
        type
        active
      }
    }
  }
`
