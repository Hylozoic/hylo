import { get } from 'lodash/fp'

export const FETCH_GROUP_SETUP_CHECKLIST = 'FETCH_GROUP_SETUP_CHECKLIST'

/**
 * Loads a group's setup checklist progress (Administrators only; null for
 * everyone else) onto the Group record as `setupChecklist`.
 */
export default function fetchGroupSetupChecklist (groupId) {
  return {
    type: FETCH_GROUP_SETUP_CHECKLIST,
    graphql: {
      query: `
        query FetchGroupSetupChecklist ($id: ID) {
          group(id: $id) {
            id
            setupChecklist {
              isCreator
              hasOtherMembers
              hasPostByOthers
              hasCreatorPost
              hasEvent
              hasInvitation
            }
          }
        }
      `,
      variables: { id: groupId }
    },
    meta: {
      extractModel: {
        getRoot: get('group'),
        modelName: 'Group'
      }
    }
  }
}
