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
          groupViews {
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
              linkedGroup {
                id
                name
                slug
                type
                parentId
                avatarUrl
                bannerUrl
                icon
                homeRoute
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
      // Also extract each menu space's linkedGroup (e.g. its `track`) as its own
      // normalized Group record — see store/util/extractNestedGroups.js
      extractModel: [
        { getRoot: get('group'), modelName: 'Group', append: true },
        { getRoot: data => collectLinkedGroups(get('group.groupViews.items', data)), modelName: 'Group', append: true }
      ]
    }
  }
}
