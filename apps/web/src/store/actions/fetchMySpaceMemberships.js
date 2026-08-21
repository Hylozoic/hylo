import { get } from 'lodash/fp'
import { FETCH_MY_SPACE_MEMBERSHIPS } from 'store/constants'

/** Membership rows from the Me payload (array or query-set items). */
function membershipsFromPayload (data) {
  const memberships = get('me.memberships', data)
  if (Array.isArray(memberships)) return memberships
  return memberships?.items || []
}

/**
 * Loads the current user's memberships with space fields (track, funding round,
 * parent group) so My Tracks / My Funding Rounds can list spaces they belong to.
 */
export default function fetchMySpaceMemberships () {
  return {
    type: FETCH_MY_SPACE_MEMBERSHIPS,
    graphql: {
      query: `
        query FetchMySpaceMemberships {
          me {
            id
            memberships {
              id
              group {
                id
                name
                slug
                type
                parentId
                icon
                avatarUrl
                bannerUrl
                memberCount
                homeRoute
                parentGroup {
                  id
                  name
                  slug
                  avatarUrl
                }
                track {
                  id
                  publishedAt
                }
                fundingRound {
                  id
                  publishedAt
                }
              }
            }
          }
        }
      `
    },
    meta: {
      extractModel: [
        {
          getRoot: get('me'),
          modelName: 'Me'
        },
        {
          getRoot: data => membershipsFromPayload(data)
            .map(membership => membership.group?.parentGroup)
            .filter(group => group?.id),
          modelName: 'Group',
          append: true
        }
      ]
    }
  }
}
