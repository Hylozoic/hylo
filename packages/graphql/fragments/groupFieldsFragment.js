import { gql } from 'urql'

export default gql`
  fragment GroupFieldsFragment on Group {
    id
    aboutVideoUri
    accessibility
    allowInPublic
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
    members(first: 4, sortBy: "last_active_at", order: "desc") {
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
