import { gql } from 'urql'

export default gql`
  fragment TrackFields on Track {
    id
    bannerUrl
    actionDescriptor
    actionDescriptorPlural
    description
    completionMessage
    completionRole {
      __typename
      ... on CommonRole {
        id
        emoji
        name
      }
      ... on GroupRole {
        id
        emoji
        name
      }
    }
    completionRoleType
    didComplete
    enrolledUsers {
      items {
        id
        avatarUrl
        completedAt
        enrolledAt
        name
      }
    }
    isEnrolled
    name
    numActions
    numPeopleCompleted
    numPeopleEnrolled
    publishedAt
    userSettings
    welcomeMessage
  }
`
