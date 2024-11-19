import { gql } from 'urql'

const groupFieldsFragment = gql`
  fragment GroupFieldsFragment on Group {
    id
    aboutVideoUri
    accessibility
    avatarUrl
    bannerUrl
    description
    geoShape
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
    }
    slug
    type
    typeDescriptor
    typeDescriptorPlural
    visibility
    agreements {
      items {
        id
        description
        order
        title
      }
    }
    childGroups {
      items {
        id
        accessibility
        avatarUrl
        bannerUrl
        geoShape
        memberCount
        name
        slug
        visibility
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
    parentGroups {
      items {
        id
        accessibility
        avatarUrl
        bannerUrl
        geoShape
        name
        slug
        visibility
      }
    }
  }
`

export default groupFieldsFragment

export const groupGroupTopicsFieldsFragment = gql`
  fragment GroupGroupTopicsFieldsFragment on Group {
    groupTopics(first: 8) {
      hasMore
      total
      items {
        id
        followersTotal
        isDefault
        isSubscribed
        lastReadPostId
        newPostCount
        postsTotal
        visibility
        group {
          id
        }
        topic {
          id
          name
        }
      }
    }
  }
`

export const groupJoinQuestionsFieldsFragment = gql`
  fragment GroupJoinQuestionsFieldsFragment on Group {
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
    }
  }
`

export const groupPrerequisiteGroupsFieldsFragment = gql`
  fragment GroupPrerequisiteGroupsFieldsFragment on Group {
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
        }
        slug
      }
    }
    numPrerequisitesLeft
  }
`

export const groupGroupExtensionsFieldsFragment = gql`
  fragment GroupGroupExtensionsFieldsFragment on Group {
    groupExtensions {
      items {
        id
        data
        type
        active
      }
    }
  }
`

export const groupWidgetsFieldsFragment = gql`
  fragment GroupWidgetsFieldsFragment on Group {
    widgets {
      items {
        id
        name
        context
        order
        isVisible
      }
    }
  }
`

export const groupPendingInvitationsFieldsFragment = gql`
  fragment GroupPendingInvitationsFieldsFragment on Group {
    pendingInvitations {
      hasMore
      items {
        id
        email
        createdAt
        lastSentAt
      }
    }
  }
`
