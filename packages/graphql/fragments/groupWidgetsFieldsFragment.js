import { gql } from 'urql'

export default gql`
  fragment GroupWidgetsFieldsFragment on Group {
    widgets {
      items {
        id
        name
        context
        order
        isVisible
      }
    }
  }
`
