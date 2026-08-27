import { get } from 'lodash/fp'
import { FETCH_GROUP_SPACES } from 'store/constants'
import { collectSpaceGroups } from 'store/util/extractNestedGroups'

/** Loads child spaces for a group (used by More Spaces). */
export default function fetchGroupSpaces (groupId) {
  return {
    type: FETCH_GROUP_SPACES,
    graphql: {
      query: `query FetchGroupSpaces ($groupId: ID) {
        group(id: $groupId) {
          id
          spaces {
            items {
              id
              name
              slug
              type
              status
              parentId
              avatarUrl
              icon
              bannerUrl
              memberCount
              openJoinRequestCount
              description
              purpose
              location
              locationObject {
                id
                fullText
              }
              acceptedPostTypes
              visibility
              accessibility
              requiredRoles
              paywall
              groupRoles {
                items {
                  id
                  name
                  emoji
                  active
                }
              }
              active
              homeRoute
              menuViewCount
              groupViews {
                items {
                  id
                  type
                  name
                  order
                  icon
                  settings
                  newPostCount
                  lastReadPostId
                  pinnedPostIds
                  pageContent
                  viewPost {
                    id
                    type
                    title
                    startTime
                    timezone
                  }
                  viewUser {
                    id
                    name
                    avatarUrl
                  }
                  linkedGroup {
                    id
                    name
                    avatarUrl
                    icon
                  }
                }
              }
              track {
                id
                actionDescriptor
                actionDescriptorPlural
                accessControlled
                canAccess
              }
              fundingRound {
                id
                phase
                submissionDescriptor
                submissionDescriptorPlural
              }
            }
          }
        }
      }`,
      variables: { groupId }
    },
    meta: {
      // Also extract each off-menu space (and its own nested space views) as its
      // own normalized Group record — see store/util/extractNestedGroups.js
      extractModel: [
        { getRoot: get('group'), modelName: 'Group', append: true },
        { getRoot: data => collectSpaceGroups(get('group.spaces.items', data)), modelName: 'Group', append: true }
      ]
    }
  }
}
