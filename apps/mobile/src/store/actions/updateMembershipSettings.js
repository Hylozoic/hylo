export const MODULE_NAME = 'UserSettings'

export const UPDATE_USER_SETTINGS = `${MODULE_NAME}/UPDATE_USER_SETTINGS`
export const UPDATE_USER_SETTINGS_PENDING = UPDATE_USER_SETTINGS + '_PENDING'
export const UPDATE_MEMBERSHIP_SETTINGS = `${MODULE_NAME}/UPDATE_MEMBERSHIP_SETTINGS`
export const UPDATE_MEMBERSHIP_SETTINGS_PENDING = UPDATE_MEMBERSHIP_SETTINGS + '_PENDING'

export function updateMembershipSettings (groupId, settings, acceptAgreements = null, questionAnswers = []) {
  return {
    type: UPDATE_MEMBERSHIP_SETTINGS,
    graphql: {
      query: `
        mutation UpdateMembershipSettings ($groupId: ID, $data: MembershipInput) {
          updateMembership(groupId: $groupId, data: $data) {
            id
          }
        }
      `,
      variables: {
        data: {
          acceptAgreements,
          questionAnswers,
          settings
        },
        groupId
      }
    },
    meta: {
      groupId,
      acceptAgreements,
      settings,
      optimistic: true
    }
  }
}
