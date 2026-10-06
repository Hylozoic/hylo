import { JOIN_REQUEST_STATUS } from 'store/models/JoinRequest'

export default
`query FetchJoinRequests ($groupId: ID) {
  joinRequests (groupId: $groupId, status: ${JOIN_REQUEST_STATUS.Pending}) {
    total
    hasMore
    items {
      id
      status
      createdAt
      questionAnswers {
        id
        question {
          id
          text
        }
        answer
      }
      group {
        id
        slug
      }
      invitedBy {
        id
        name
        avatarUrl
      }
      user {
        id
        avatarUrl
        name
        skills {
          items {
            id
            name
          }
        }
      }
    }
  }
}`
