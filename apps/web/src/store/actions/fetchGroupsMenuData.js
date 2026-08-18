import { get } from 'lodash/fp'
import { FETCH_GROUPS_MENU_DATA } from 'store/constants'
import {
  collectLinkedGroupsFromGroupsQuery,
  collectSpaceGroupsFromGroupsQuery
} from 'store/util/extractNestedGroups'

// Fetches context menu data for a batch of groups.
// Preloads groupViews, spaces, and legacy contextWidgets so group menus render
// immediately when switching groups, without waiting for per-group fetches.
// Accepts a subset of groupIds to support pagination (typically 10 at a time).
export default function fetchGroupsMenuData (groupIds) {
  return {
    type: FETCH_GROUPS_MENU_DATA,
    graphql: {
      query: groupsMenuDataQuery,
      variables: {
        groupIds,
        first: groupIds.length
      }
    },
    meta: {
      extractModel: [
        {
          getRoot: get('groups'),
          modelName: 'Group',
          append: true
        },
        {
          getRoot: data => collectLinkedGroupsFromGroupsQuery(get('groups', data)),
          modelName: 'Group',
          append: true
        },
        {
          getRoot: data => collectSpaceGroupsFromGroupsQuery(get('groups', data)),
          modelName: 'Group',
          append: true
        }
      ]
    }
  }
}

const groupsMenuDataQuery = `
query FetchGroupsMenuData (
  $groupIds: [ID],
  $first: Int
) {
  groups(
    groupIds: $groupIds,
    first: $first
  ) {
    items {
      id
      avatarUrl
      bannerUrl
      description
      name
      purpose
      slug
      type
      parentId
      icon
      homeRoute
      visibility
      accessibility
      acceptedPostTypes
      memberCount
      paywall
      settings {
        allowGroupInvites
        showWelcomePage
        layout
      }
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
                  title
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
            title
          }
          viewUser {
            id
            name
            avatarUrl
          }
        }
      }
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
              settings
              newPostCount
              lastReadPostId
              pageContent
              viewPost {
                id
                title
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
      customViews {
        items {
          id
          groupId
          collectionId
          externalLink
          isActive
          icon
          name
          order
          postTypes
          topics {
            id
            name
          }
          type
        }
      }
      contextWidgets {
        items {
          id
          autoAdded
          title
          type
          order
          visibility
          view
          icon
          highlightNumber
          secondaryNumber
          parentId
          viewGroup {
            id
            avatarUrl
            bannerUrl
            name
            memberCount
            visibility
            accessibility
            slug
          }
          viewPost {
            id
            announcement
            title
            details
            type
            createdAt
            startTime
            endTime
            isPublic
          }
          customView {
            id
            groupId
            collectionId
            externalLink
            isActive
            icon
            name
            order
            postTypes
            topics {
              id
              name
            }
            type
          }
          viewUser {
            id
            name
            avatarUrl
          }
          viewChat {
            id
            name
          }
          viewFundingRound {
            id
            title
            isParticipating
            publishedAt
            submissionsOpenAt
            submissionsCloseAt
            votingOpensAt
            votingClosesAt
          }
          viewTrack {
            id
            name
            didComplete
            isEnrolled
            numActions
            publishedAt
          }
        }
      }
    }
  }
}
`
