export const MODULE_NAME = 'GroupWelcomeModal'
export const FETCH_GROUP_WELCOME_DATA = `${MODULE_NAME}/FETCH_GROUP_WELCOME_DATA`

export const groupWelcomeQuery = `
  query GroupWelcomeQuery ($id: ID, $userId: ID) {
    group (id: $id) {
      id
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
      agreements {
        items {
          id
          description
          title
        }
      }
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
      memberships (userId: $userId) {
        items {
          id
          agreements {
            items {
              id
              accepted
            }
          }
          person {
            id
          }
          settings {
            joinQuestionsAnsweredAt
            agreementsAcceptedAt
            showJoinForm
          }
        }
      }
    }
  }
`

export function fetchGroupWelcomeData (id, userId) {
  return {
    type: FETCH_GROUP_WELCOME_DATA,
    graphql: {
      query: groupWelcomeQuery,
      variables: { id, userId }
    },
    meta: {
      extractModel: 'Group',
      id,
      userId
    }
  }
}
