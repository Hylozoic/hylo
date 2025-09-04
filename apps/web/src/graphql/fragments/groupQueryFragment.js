import groupTopicsQueryFragment from '@graphql/fragments/groupTopicsQueryFragment'

// TODO: dont load all this unless looking at the explore page

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
    parentGroups {
      items {
        id
        name
        avatarUrl
        bannerUrl
        memberCount
        visibility
        accessibility
        slug
      }
    }
    childGroups {
      items {
        id
        name
        avatarUrl
        bannerUrl
        memberCount
        visibility
        accessibility
        slug
      }
    }
    peerGroups {
      items {
        id
        name
        avatarUrl
        bannerUrl
        memberCount
        visibility
        accessibility
        slug
      }
    }
    groupRelationshipInvitesFrom {
      items {
        id
        fromGroup {
          id
          name
          avatarUrl
          bannerUrl
          memberCount
          visibility
          accessibility
          slug
        }
        toGroup {
          id
          name
          avatarUrl
          bannerUrl
          memberCount
          visibility
          accessibility
          slug
        }
        type
        status
        createdBy {
          id
          name
        }
      }
    }
    groupRelationshipInvitesTo {
      items {
        id
        fromGroup {
          id
          name
          avatarUrl
          bannerUrl
          memberCount
          visibility
          accessibility
          slug
        }
        toGroup {
          id
          name
          avatarUrl
          bannerUrl
          memberCount
          visibility
          accessibility
          slug
        }
        type
        status
        createdBy {
          id
          name
        }
      }
    }
  }`
}
