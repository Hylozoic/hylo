import { gql } from 'urql'

export default gql`
  fragment TrackFields on Track {
    id
    bannerUrl
    actionsName
    description
    completionMessage
    completionRole {
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
