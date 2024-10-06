import { gql } from 'urql'

export const updateUserSettingsMutation = gql`
  mutation ($changes: MeInput) {
    updateMe(changes: $changes) {
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

export default updateUserSettingsMutation
