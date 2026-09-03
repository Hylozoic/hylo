import { MARK_VIEW_AS_READ } from 'store/constants'

/**
 * Mark a typed common view as read (zeros newPostCount, advances lastReadPostId).
 * Optimistically patches the embedded group.groupViews menu.
 */
export default function markViewAsRead (viewId, groupId) {
  return {
    type: MARK_VIEW_AS_READ,
    graphql: {
      query: `mutation($viewId: ID!) {
        markViewAsRead(viewId: $viewId) {
          id
          newPostCount
          lastReadPostId
        }
      }`,
      variables: { viewId }
    },
    meta: {
      id: viewId,
      groupId,
      data: { newPostCount: 0 },
      optimistic: true
    }
  }
}
