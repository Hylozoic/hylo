import { gql } from 'urql'

export default gql`
  mutation ($email: String, $password: String) {
    login(email: $email, password: $password) {
      me {
        id
        email
        emailValidated
        hasRegistered
        name
        settings {
          alreadySeenTour
          digestFrequency
          dmNotifications
          commentNotifications
          signupInProgress
          streamChildPosts
          streamViewMode
          streamSortBy
          streamPostType
        }
      }
      error
    }
  }
`
