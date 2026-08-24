// Core group fields for stream / chat / nav (groupTopics loaded on demand, e.g. community_topics widget).
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
    description
    eventCalendarUrl
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
    }
    slug
    type
    parentId
    icon
    acceptedPostTypes
    typeDescriptor
    typeDescriptorPlural
    visibility
    websiteUrl
    paywall
    canAccess
    groupRoles(first: 100, order: "asc") {
      items {
        id
        name
        active
        emoji
        groupId
        membersTotal
        type
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
  }`
}
