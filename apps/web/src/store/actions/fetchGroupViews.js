import { get } from 'lodash/fp'
import { FETCH_GROUP_VIEWS } from 'store/constants'
import { collectLinkedGroups } from 'store/util/extractNestedGroups'

export default function fetchGroupViews (groupId) {
  return {
    type: FETCH_GROUP_VIEWS,
    graphql: {
      query: `query FetchGroupViews ($groupId: ID) {
        group(id: $groupId) {
          id
          openJoinRequestCount
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
          groupViews(menuOnly: true) {
            items {
              id
              type
              name
              order
              icon
              link
              pageContent
              topics
              settings
              newPostCount
              lastReadPostId
              pinnedPostIds
              linkedGroup {
                id
                name
                slug
                status
                avatarUrl
                icon
                homeRoute
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
                menuViewCount
              }
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
            }
          }
        }
      }`,
      variables: { groupId }
    },
    meta: {
      groupId,
      // Also extract each menu space's linkedGroup as its own normalized Group
      // record — see store/util/extractNestedGroups.js
      extractModel: [
        { getRoot: get('group'), modelName: 'Group', append: true },
        { getRoot: data => collectLinkedGroups(get('group.groupViews.items', data)), modelName: 'Group', append: true }
      ]
    }
  }
}
