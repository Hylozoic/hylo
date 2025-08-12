const groupFieldsFragment = ({ withTopics, withJoinQuestions, withPrerequisites, withExtensions, withWidgets = false, withContextWidgets = false }) => `
  id
  aboutVideoUri
  accessibility
  allowInPublic
  avatarUrl
  bannerUrl
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
  agreements {
    items {
      id
      description
      order
      title
    }
  }
  customViews {
    items {
      id
      activePostsOnly
      collectionId
      defaultSort
      defaultViewMode
      externalLink
      groupId
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
  members(first: 8, sortBy: "name", order: "desc") {
    items {
      id
      name
      avatarUrl
    }
  }
  stewards {
    items {
      id
      name
      avatarUrl
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
      membershipCommonRoles {
        items {
          id
          groupId
          userId
          roleId
        }
      }
    }
  }
  ${withTopics
    ? `
    groupTopics(first: 8) {
      items {
        id
        topic {
          id
          name
        }
        postsTotal
      }
    }`
    : ''}
  ${withJoinQuestions
    ? `
    joinQuestions {
      items {
        id
        questionId
        text
      }
    }
    suggestedSkills {
      items {
        id
        name
      }
    }`
    : ''}
  ${withPrerequisites
    ? `
    prerequisiteGroups(onlyNotMember: true) {
      items {
        avatarUrl
        id
        name
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
      }
    }
    numPrerequisitesLeft
    `
    : ''}
  ${withExtensions
    ? `
    groupExtensions {
      items {
        id
        data
        type
        active
      }
    }`
    : ''}
  ${withWidgets
    ? `
    widgets {
      items {
        id
        name
        context
        order
        isVisible
      }
    }`
    : ''}
    ${withContextWidgets
      ? `
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
      }`
      : ''}
`

export default groupFieldsFragment
