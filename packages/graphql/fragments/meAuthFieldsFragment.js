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
      colorScheme
      dmNotifications
      commentNotifications
      locale
      globalNavStyle
      groupNavStyle
      rsvpCalendarSub
      signupInProgress
      stackGroups
      independentSpaceMenu
      streamChildPosts
      streamViewMode
      streamSortBy
      streamPostType
      theme
    }
  }
`
