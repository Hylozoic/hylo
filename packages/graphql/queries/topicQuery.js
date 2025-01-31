import { gql } from 'urql'

export default gql`
  query TopicQuery($name: String, $id: ID) {
    topic(name: $name, id: $id) {
      id
      name
      postsTotal
      followersTotal
    }
  }
`
