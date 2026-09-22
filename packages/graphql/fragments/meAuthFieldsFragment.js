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
      toursSeen
      colorScheme
      dmNotifications
      commentNotifications
      locale
      globalNavStyle
      groupNavStyle
      rsvpCalendarSub
      signupInProgress
      stackGroups
      streamChildPosts
      streamViewMode
      streamSortBy
      streamPostType
      theme
    }
  }
`
