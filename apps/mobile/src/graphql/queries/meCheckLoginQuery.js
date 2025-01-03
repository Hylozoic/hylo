import { gql } from 'urql'

export default gql`
  query MeCheckLoginQuery {
    me {
      id
      avatarUrl
      email
      emailValidated
      hasRegistered
      name
      settings {
        alreadySeenTour
        digestFrequency
        dmNotifications
        commentNotifications
        locale
        signupInProgress
        streamChildPosts
        streamViewMode
        streamSortBy
        streamPostType
      }
    }
  }
`
