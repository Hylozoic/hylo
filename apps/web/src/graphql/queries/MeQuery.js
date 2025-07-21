import gql from 'graphql-tag'

export default gql`
  query MeQuery {
    me {
      ...MeCompleteFragment
    }
  }

  fragment MeCompleteFragment on Me {
    id
    isAdmin
    name
    avatarUrl
    createdAt
    hasRegistered
    newNotificationCount
    unseenThreadCount
    location
    locationObject {
      id
      addressNumber
      addressStreet
      bbox {
        lat
        lng
      }
      center {
        lat
        lng
      }
      city
      country
      fullText
      locality
      neighborhood
      region
    }
    email
    emailValidated
    bannerUrl
    bio
    contactEmail
    contactPhone
    tagline
    twitterName
    linkedinUrl
    facebookUrl
    url
    intercomHash
    hasStripeAccount
    settings {
      alreadySeenTour
      dmNotifications
      commentNotifications
      locale
      mapBaseLayer
      signupInProgress
      streamChildPosts
      streamViewMode
      streamSortBy
      streamPostType
    }
    joinRequests(status: 0) {
      items {
        id
        status
        createdAt
        group {
          id
        }
      }
    }
    groupRoles {
      items {
        id
        name
        emoji
        active
        groupId
        responsibilities {
          items {
            id
            title
            description
          }
        }
      }
    }
    # For memberships only including only what is needed
    # for initial load in AuthLayoutRouter
    memberships {
      id
      lastViewedAt
      navOrder
      newPostCount
      person {
        id
      }
      settings {
        agreementsAcceptedAt
        digestFrequency
        joinQuestionsAnsweredAt
        postNotifications
        sendEmail
        sendPushNotifications
        showJoinForm
      }
      group {
        id
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
    membershipCommonRoles {
      items {
        id
        commonRoleId
        groupId
        userId
      }
    }
    skills {
      items {
        id
        name
      }
    }
    cookieConsentPreferences {
      id
      settings
      version
      updatedAt
    }
  }
`
