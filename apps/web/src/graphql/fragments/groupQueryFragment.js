import groupTopicsQueryFragment from '@graphql/fragments/groupTopicsQueryFragment'

// Core group fields + topics for stream / chat / nav (no parent/child/peer/relationship lists).
export default function groupQueryFragment () {
  return `group(slug: $slug, updateLastViewed: $updateLastViewed) {
    id
    aboutVideoUri
    accessibility
    allowInPublic
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
    customViews {
      items {
        id
        groupId
        activePostsOnly
        collectionId
        defaultSort
        defaultViewMode
        externalLink
        isActive
        icon
        name
        order
        postTypes
        topics {
          id
          name
        }
        type
      }
    }
    description
    eventCalendarUrl
    geoShape
    invitePath
    location
    memberCount
    stewardDescriptor
    stewardDescriptorPlural
    name
    purpose
    settings {
      agreementsLastUpdatedAt
      allowGroupInvites
      askGroupToGroupJoinQuestions
      askJoinQuestions
      defaultDigestFrequency
      hideExtensionData
      locationDisplayPrecision
      publicMemberDirectory
      showSuggestedSkills
      showWelcomePage
    }
    slug
    type
    typeDescriptor
    typeDescriptorPlural
    visibility
    websiteUrl
    welcomePage
    groupRoles {
      items {
        id
        name
        active
        emoji
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
    stewards {
      items {
        id
        avatarUrl
        lastActiveAt
        name
        membershipCommonRoles {
          items {
            id
            groupId
            userId
            commonRoleId
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
      }
    }
    contextWidgets {
      items {
        id
        autoAdded
        title
        type
        order
        visibility
        view
        icon
        highlightNumber
        secondaryNumber
        parentId
        viewGroup {
          id
          avatarUrl
          bannerUrl
          name
          memberCount
          visibility
          accessibility
          slug
        }
        viewPost {
          id
          announcement
          title
          details
          type
          createdAt
          startTime
          endTime
          isPublic
        }
        customView {
          id
          groupId
          collectionId
          externalLink
          isActive
          icon
          name
          order
          postTypes
          topics {
            id
            name
          }
          type
        }
        viewUser {
          id
          name
          avatarUrl
        }
        viewChat {
          id
          name
        }
        viewFundingRound {
          id
          title
          isParticipating
          publishedAt
          submissionsOpenAt
          submissionsCloseAt
          votingOpensAt
          votingClosesAt
        }
        viewTrack {
          id
          name
          didComplete
          isEnrolled
          numActions
          publishedAt
        }
      }
    }
    ${groupTopicsQueryFragment}
  }`
}
