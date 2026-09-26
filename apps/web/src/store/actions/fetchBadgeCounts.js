import { get } from 'lodash/fp'
import { FETCH_BADGE_COUNTS } from 'store/constants'

/**
 * Refetches only what the nav badges read (group new-post counts, unseen
 * threads, new notifications), without the rest of MeQuery.
 */
export default function fetchBadgeCounts () {
  return {
    type: FETCH_BADGE_COUNTS,
    graphql: {
      query: `query FetchBadgeCounts {
        me {
          id
          newNotificationCount
          unseenThreadCount
          memberships {
            id
            newPostCount
            person {
              id
            }
            group {
              id
            }
          }
        }
      }`
    },
    meta: {
      extractModel: [
        {
          getRoot: get('me'),
          modelName: 'Me'
        }
      ]
    }
  }
}
