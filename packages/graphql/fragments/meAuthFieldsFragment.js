import { gql } from 'urql'

export default gql`
  fragment MeAuthFieldsFragment on Me {
    id
      avatarUrl
      email
      emailValidated
      hasRegistered
      name
      settings {
        alreadySeenTour
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
`
