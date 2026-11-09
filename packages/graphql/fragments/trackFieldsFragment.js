import { gql } from 'urql'

export default gql`
  fragment TrackFields on Track {
    id
    accessControlled
    canAccess
    actionDescriptor
    actionDescriptorPlural
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
    numActions
    numPeopleCompleted
    numPeopleEnrolled
    userSettings
    space {
      id
      name
      bannerUrl
      description
      avatarUrl
      slug
      type
      status
      homeRoute
      parentGroup {
        id
        slug
      }
    }
  }
`
