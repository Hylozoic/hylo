import { gql } from 'urql'

export default gql`
  fragment TrackFieldsFragment on Track {
    id
    bannerUrl
    actionsName
    description
    didComplete
  isEnrolled
  name
  numActions
  numPeopleCompleted
  numPeopleEnrolled
  userSettings
  publishedAt
  groups {
    items {
      id
      avatarUrl
      name
      slug
    }
  }
}`
