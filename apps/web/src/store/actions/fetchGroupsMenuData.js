import { get } from 'lodash/fp'
import { FETCH_GROUPS_MENU_DATA } from 'store/constants'

// Fetches context menu data for multiple groups in a single bulk request.
// This preloads the contextWidgets and related fields needed to render
// group context menus immediately, without waiting for individual group fetches.
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
      visibility
      accessibility
      memberCount
      settings {
        allowGroupInvites
        showWelcomePage
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

