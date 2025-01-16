import { gql } from 'urql'

export default gql`
  query TopicsForGroupIdQuery ($searchTerm: String, $groupId: ID) {
    group(id: $groupId) {
      groupTopics(autocomplete: $searchTerm, first: 20) {
        items {
          topic {
            id
            followersTotal
            name
            postsTotal
          }
        }
      }
    }
  }
`
