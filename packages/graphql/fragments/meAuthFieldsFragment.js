import { gql } from 'urql'

export default gql`
  fragment MeAuthFieldsFragment on Me {
    id
    avatarUrl
    email
    emailValidated
    emailUndeliverable
    hasRegistered
    name
    settings {
      alreadySeenTour
      toursSeen
      colorScheme
      dmNotifications
      commentNotifications
      unifiedEmailDigest
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
