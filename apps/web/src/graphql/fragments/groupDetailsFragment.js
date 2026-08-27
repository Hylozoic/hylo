const groupFieldsFragment = ({ withTopics, withJoinQuestions, withPrerequisites, withExtensions, withWidgets = false }) => `
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
  openJoinRequestCount
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
    layout
  }
  slug
  type
  status
  active
  parentId
  icon
  acceptedPostTypes
  typeDescriptor
  typeDescriptorPlural
  visibility
  websiteUrl
  paywall
  canAccess
  track {
    id
    actionDescriptor
    actionDescriptorPlural
    completionMessage
    completionRole {
      id
      name
      emoji
    }
    accessControlled
    canAccess
  }
  fundingRound {
    id
    phase
    allowSelfVoting
    allowLateJoiners
    hideFinalResultsFromParticipants
    votingMethod
    totalTokens
    tokenType
    maxTokenAllocation
    minTokenAllocation
    requireBudget
    submissionDescriptor
    submissionDescriptorPlural
    submissionsOpenAt
    submissionsCloseAt
    votingOpensAt
    votingClosesAt
    criteria
    submitterRoles {
      id
      emoji
      name
    }
    voterRoles {
      id
      emoji
      name
    }
  }
  agreements {
    items {
      id
      description
      order
      title
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
      groupRoles(slug: $slug) {
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
          defaultDigestFrequency
          hideExtensionData
          locationDisplayPrecision
          publicMemberDirectory
          showSuggestedSkills
          showWelcomePage
          layout
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
`

export default groupFieldsFragment
