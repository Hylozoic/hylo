import { get } from 'lodash/fp'
import { UPDATE_GROUP_VIEW_USER } from 'store/constants'

/**
 * Update the current user's last-read position for a chat GroupView.
 * Optimistically sets lastReadPostId and newPostCount on the GroupView ORM model,
 * then the backend response refreshes with the actual recalculated values.
 */
export default function updateGroupViewUser (viewId, data) {
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
      data: { newPostCount: 0, ...data },
      optimistic: true,
      extractModel: [
        {
          getRoot: get('updateGroupViewUser'),
          modelName: 'GroupView'
        }
      ]
    }
  }
}
