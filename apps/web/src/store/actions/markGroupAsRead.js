import { get } from 'lodash/fp'
import { MARK_GROUP_AS_READ } from 'store/constants'

/**
 * Mark all views in a group as read and clear the membership group badge.
 */
export default function markGroupAsRead (groupId) {
  return {
    type: MARK_GROUP_AS_READ,
    graphql: {
      query: `mutation($groupId: ID!) {
        markGroupAsRead(groupId: $groupId) {
          id
        }
      }`,
      variables: { groupId }
    },
    meta: {
      groupId,
      optimistic: true,
      extractModel: [
        {
          getRoot: get('markGroupAsRead'),
          modelName: 'Group'
        }
      ]
    }
  }
}
