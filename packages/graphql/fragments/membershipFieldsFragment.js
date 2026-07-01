import { gql } from 'urql'

export default gql`
  fragment MembershipFieldsFragment on Membership {
    id
    lastViewedAt
    navOrder
    newPostCount
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
      homeRoute
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
        layout
      }
      slug
      allowInPublic
      accessibility
    }
  }
`
