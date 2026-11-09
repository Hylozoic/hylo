import { UPDATE_GROUP_VIEW_USER } from 'store/constants'

/**
 * Update the current user's last-read position for a chat GroupView.
 * Optimistically patches lastReadPostId/newPostCount on the group's embedded
 * groupViews menu (see UPDATE_GROUP_VIEW_USER_PENDING), then refreshes from the
 * backend response. Do not extractModel as GroupView — the mutation only
 * returns badge fields, and upserting that partial row is enough to drop
 * type/order/linkedGroup if anything later copies ORM GroupViews into the menu.
 *
 * @param {string|number} viewId - GroupView id
 * @param {object} data - fields to update (typically { lastReadPostId })
 * @param {string|number} groupId - owning group id (required for menu optimistic update)
 */
export default function updateGroupViewUser (viewId, data, groupId) {
  return {
    type: UPDATE_GROUP_VIEW_USER,
    graphql: {
      query: `mutation($viewId: ID!, $lastReadPostId: ID) {
        updateGroupViewUser(viewId: $viewId, lastReadPostId: $lastReadPostId) {
          id
          newPostCount
          lastReadPostId
        }
      }`,
      variables: { viewId, ...data }
    },
    meta: {
      id: viewId,
      groupId,
      data: { newPostCount: 0, ...data },
      optimistic: true
    }
  }
}
