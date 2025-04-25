import { gql } from 'urql'

export default gql`
  fragment TrackFields on Track {
    id
    bannerUrl
    actionsName
    description
    completionBadgeEmoji
    completionBadgeName
    completionMessage
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
