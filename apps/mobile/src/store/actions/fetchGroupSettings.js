import { FETCH_GROUP_SETTINGS } from 'store/constants'

export default function fetchGroupSettings (id) {
  return {
    type: FETCH_GROUP_SETTINGS,
    graphql: {
      query: `
        query ($id: ID) {
          group (id: $id) {
            id
            accessibility
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
            location
            invitePath
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
            visibility
            childGroups (first: 100) {
              items {
                id
                name
                avatarUrl
              }
            }
            stewards (first: 100) {
              hasMore
              items {
                id
                name
                avatarUrl
              }
            }
            parentGroups (first: 100) {
              items {
                id
                name
                avatarUrl
              }
            }
            pendingInvitations {
              hasMore
              items {
                id
                email
                createdAt
                lastSentAt
              }
            }
            joinQuestions {
              items {
                id
                questionId
                text
              }
            }
          }
        }
      `,
      variables: {
        id
      }
    },
    meta: {
      extractModel: 'Group',
      id
    }
  }
}

