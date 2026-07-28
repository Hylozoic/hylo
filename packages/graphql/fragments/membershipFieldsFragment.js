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
      acceptedPostTypes
      avatarUrl
      bannerUrl
      icon
      name
      memberCount
      stewardDescriptor
      stewardDescriptorPlural
      parentId
      settings {
        showSuggestedSkills
        showWelcomePage
        layout
      }
      slug
      type
      allowInPublic
      accessibility
    }
  }
`
