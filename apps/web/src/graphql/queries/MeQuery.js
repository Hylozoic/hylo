import gql from 'graphql-tag'

export default gql`
  query MeQuery ($includeChildGroups: Boolean!) {
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
    isProfilePublic
    rsvpCalendarUrl
    settings {
      alreadySeenTour
      toursSeen
      colorScheme
      dmNotifications
      commentNotifications
      locale
      mapBaseLayer
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
        acceptedPostTypes
        avatarUrl
        bannerUrl
        homeRoute
        icon
        name
        memberCount
        parentId
        stewardDescriptor
        stewardDescriptorPlural
        settings {
          showSuggestedSkills
          showWelcomePage
          layout
        }
        slug
        type
        allowInPublic
        childGroups @include(if: $includeChildGroups) {
          items {
            id
            name
            avatarUrl
            slug
            visibility
            accessibility
          }
        }
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
