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
              parentId
              avatarUrl
              icon
              bannerUrl
              memberCount
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
              groupViews {
                items {
                  id
                  type
                  name
                  order
                  icon
                  newPostCount
                  lastReadPostId
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
                name
                actionDescriptor
                actionDescriptorPlural
                completionMessage
                completionRole {
                  id
                  name
                  emoji
                }
                publishedAt
                accessControlled
                canAccess
              }
              fundingRound {
                id
                title
                publishedAt
                phase
                allowSelfVoting
                hideFinalResultsFromParticipants
                votingMethod
                totalTokens
                tokenType
                maxTokenAllocation
                minTokenAllocation
                requireBudget
                submissionDescriptor
                submissionDescriptorPlural
                submissionsOpenAt
                submissionsCloseAt
                votingOpensAt
                votingClosesAt
                criteria
                description
                submitterRoles {
                  id
                  emoji
                  name
                }
                voterRoles {
                  id
                  emoji
                  name
                }
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
