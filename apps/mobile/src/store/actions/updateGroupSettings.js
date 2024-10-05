import { UPDATE_GROUP_SETTINGS } from 'store/constants'

export default function updateGroupSettings (id, changes) {
  return {
    type: UPDATE_GROUP_SETTINGS,
    graphql: {
      query: `mutation ($id: ID, $changes: GroupInput) {
        updateGroupSettings(id: $id, changes: $changes) {
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
          }
          joinQuestions {
            items {
              id
              questionId
              text
            }
          }
        }
      }`,
      variables: {
        id, changes
      }
    },
    meta: {
      id,
      changes,
      extractModel: 'Group',
      optimistic: true
    }
  }
}
