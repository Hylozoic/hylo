import { FETCH_VIEW_PINNED_POSTS } from 'store/constants'
import postCardFieldsFragment from '@graphql/fragments/postCardFieldsFragment'

/**
 * Load the posts pinned to one view. Merged onto that view in the group's
 * embedded groupViews menu (does not replace the rest of the menu).
 */
export default function fetchViewPinnedPosts (groupId, viewId) {
  return {
    type: FETCH_VIEW_PINNED_POSTS,
    graphql: {
      query: `query FetchViewPinnedPosts ($groupId: ID, $viewId: ID) {
        group(id: $groupId) {
          id
          groupViews(id: $viewId) {
            items {
              id
              pinnedPostIds
              pinnedPosts {
                ${postCardFieldsFragment()}
              }
            }
          }
        }
      }`,
      variables: { groupId, viewId }
    },
    meta: { groupId, viewId }
  }
}
