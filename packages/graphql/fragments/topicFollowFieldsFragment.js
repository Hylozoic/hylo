import { gql } from 'urql'

export default gql`
  fragment TopicFollowFieldsFragment on TopicFollow {
    id
    lastReadPostId
    newPostCount
    settings {
      notifications
    }
    group {
      id
      name
      slug
    }
    topic {
      id
      name
    }
  }
` 