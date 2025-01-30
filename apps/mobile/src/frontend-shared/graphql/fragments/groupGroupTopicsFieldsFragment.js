import { gql } from 'urql'

export default gql`
  fragment GroupGroupTopicsFieldsFragment on Group {
    groupTopics(first: 8) {
      hasMore
      total
      items {
        id
        followersTotal
        isDefault
        isSubscribed
        lastReadPostId
        newPostCount
        postsTotal
        visibility
        group {
          id
        }
        topic {
          id
          name
        }
      }
    }
  }
`
