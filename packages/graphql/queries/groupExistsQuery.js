import { gql } from 'urql'

export default gql`
  query GroupExistsQuery ($slug: String) {
    groupExists (slug: $slug) {
      exists
    }
  }
`
