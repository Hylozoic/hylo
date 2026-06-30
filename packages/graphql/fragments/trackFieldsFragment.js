import { gql } from 'urql'

export default gql`
  fragment TrackFields on Track {
    id
    accessControlled
    canAccess
    bannerUrl
    actionDescriptor
    actionDescriptorPlural
    description
    completionMessage
    completionRole {
      id
      emoji
      name
    }
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
