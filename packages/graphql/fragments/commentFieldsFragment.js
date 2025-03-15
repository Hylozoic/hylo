import { gql } from 'urql'

export default gql`
  fragment CommentFieldsFragment on Comment {
    id
    text
    creator {
      id
      name
      avatarUrl
    }
    attachments {
      id
      position
      type
      url
    }
    post {
      id
    }
    parentComment {
      id
    }
    myReactions {
      emojiFull
      id
    }
    commentReactions {
      emojiFull
      id
      user {
        id
        name
      }
    }
    createdAt
  }
`
