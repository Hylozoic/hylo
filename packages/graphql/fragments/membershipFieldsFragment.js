import { gql } from 'urql'

export default gql`
  fragment MembershipFieldsFragment on Membership {
    id
    lastViewedAt
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
      showJoinForm
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
    }
  }
`
