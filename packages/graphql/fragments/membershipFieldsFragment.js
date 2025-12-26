import { gql } from 'urql'

export default gql`
  fragment MembershipFieldsFragment on Membership {
    id
    lastViewedAt
    navOrder
    newPostCount
    hasModeratorRole
    person {
      id
    }
    settings {
      agreementsAcceptedAt
      joinQuestionsAnsweredAt
      sendEmail
      sendPushNotifications
      sendEventRsvpEmail
      showJoinForm
      digestFrequency
      postNotifications
    }
    group {
      id
      agreements {
        items {
          id
          description
          order
          title
        }
      }
      avatarUrl
      bannerUrl
      name
      memberCount
      stewardDescriptor
      stewardDescriptorPlural
      settings {
        showSuggestedSkills
        showWelcomePage
      }
      slug
      allowInPublic
    }
  }
`
