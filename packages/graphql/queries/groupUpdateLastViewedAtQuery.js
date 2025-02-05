import { gql } from 'urql'

export default gql`
  query GroupUpdateLastViewedQuery ($slug: String, $id: ID) {
    group(slug: $slug, id: $id, updateLastViewed: true) {
      id
    }
  }
`
