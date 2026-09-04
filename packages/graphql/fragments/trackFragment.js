import { gql } from 'urql'

export default gql`
  fragment TrackFieldsFragment on Track {
    id
    actionDescriptor
    actionDescriptorPlural
    didComplete
    isEnrolled
    numActions
    numPeopleCompleted
    numPeopleEnrolled
    userSettings
    space {
      id
      avatarUrl
      bannerUrl
      description
      name
      slug
      type
      status
      homeRoute
      parentGroup {
        id
        avatarUrl
        name
        slug
      }
    }
  }
`
