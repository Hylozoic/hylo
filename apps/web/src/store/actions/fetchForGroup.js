import { get } from 'lodash/fp'
import { FETCH_FOR_GROUP } from 'store/constants'

const queryFragment = `group(slug: $slug, updateLastViewed: $updateLastViewed) {
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
    requiredRoles
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
      showPostNoticesInChat
      layout
    }
    slug
    type
    parentId
    icon
    homeRoute
    acceptedPostTypes
    typeDescriptor
    typeDescriptorPlural
    visibility
    websiteUrl
    paywall
    canAccess
    stripeAccountId
    stripeChargesEnabled
    stripePayoutsEnabled
    stripeDetailsSubmitted
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
      publishedAt
      accessControlled
      canAccess
    }
    fundingRound {
      id
      publishedAt
      phase
      allowSelfVoting
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
  }
`

export default function fetchForGroup (slug) {
  return {
    type: FETCH_FOR_GROUP,
    graphql: {
      query: `query FetchForGroup ($slug: String, $updateLastViewed: Boolean) {
        ${queryFragment}
      }`,
      variables: { slug, updateLastViewed: true }
    },
    meta: {
      extractModel: [
        {
          getRoot: get('group'),
          modelName: 'Group',
          append: true
        }
      ],
      slug
    }
  }
}
