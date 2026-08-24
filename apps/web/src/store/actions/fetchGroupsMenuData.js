import { get } from 'lodash/fp'
import { FETCH_GROUPS_MENU_DATA } from 'store/constants'
import {
  collectLinkedGroupsFromGroupsQuery,
  collectSpaceGroupsFromGroupsQuery
} from 'store/util/extractNestedGroups'

// Fetches context menu data for a batch of groups.
// Preloads groupViews and spaces so group menus render
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
          pinnedPostIds
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
              actionDescriptor
              actionDescriptorPlural
              publishedAt
              accessControlled
              canAccess
            }
            fundingRound {
              id
              publishedAt
              phase
              submissionDescriptor
              submissionDescriptorPlural
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
                pinnedPostIds
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
              pinnedPostIds
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
            actionDescriptor
            actionDescriptorPlural
            publishedAt
            accessControlled
            canAccess
          }
          fundingRound {
            id
            publishedAt
            phase
            submissionDescriptor
            submissionDescriptorPlural
          }
        }
      }
    }
  }
}
`
