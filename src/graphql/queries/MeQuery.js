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
    hasDevice
    intercomHash
    hasStripeAccount
    blockedUsers {
      id
      name
    }
    settings {
      alreadySeenTour
      digestFrequency
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
    affiliations {
      items {
        id
        role
        preposition
        orgName
        url
        createdAt
        updatedAt
        isActive
      }
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
      commonRoles {
        items {
          id
          name
          description
          emoji
          responsibilities {
            items {
              id
              title
              description
            }
          }
        }
      }
      group {
        id
        avatarUrl
        bannerUrl
        name
        memberCount
        moderatorDescriptor
        moderatorDescriptorPlural
        settings {
          showSuggestedSkills
        }
        slug
      }
    }
    skills {
      items {
        id
        name
      }
    }
  }
`
