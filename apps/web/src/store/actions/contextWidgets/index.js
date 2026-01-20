import {
  CREATE_CONTEXT_WIDGET,
  DELETE_CONTEXT_WIDGET,
  UPDATE_CONTEXT_WIDGET,
  REORDER_CONTEXT_WIDGET,
  REMOVE_WIDGET_FROM_MENU,
  SET_HOME_WIDGET
} from 'store/constants'

export function createContextWidget ({ groupId, data }) {
  return {
    type: CREATE_CONTEXT_WIDGET,
    graphql: {
      query: `mutation ($groupId: ID, $data: ContextWidgetInput) {
        createContextWidget(groupId: $groupId, data: $data) {
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
      }`,
      variables: { groupId, data }
    },
    meta: {
      groupId,
      data,
      optimistic: true
    }
  }
}

export function deleteContextWidget ({ contextWidgetId, groupId }) {
  return {
    type: DELETE_CONTEXT_WIDGET,
    graphql: {
      query: `mutation ($contextWidgetId: ID) {
        deleteContextWidget(contextWidgetId: $contextWidgetId) {
          success
        }
      }`,
      variables: { contextWidgetId }
    },
    meta: {
      contextWidgetId,
      groupId,
      optimistic: true
    }
  }
}

export function updateContextWidget ({ contextWidgetId, data, groupId }) {
  return {
    type: UPDATE_CONTEXT_WIDGET,
    graphql: {
      query: `mutation ($contextWidgetId: ID, $data: ContextWidgetInput) {
        updateContextWidget(contextWidgetId: $contextWidgetId, data: $data) {
          id
          title
          order
          parentId
          visibility
        }
      }`,
      variables: { contextWidgetId, data }
    },
    meta: {
      contextWidgetId,
      groupId,
      data,
      optimistic: true
    }
  }
}

export function reorderContextWidget ({ contextWidgetId, order }) {
  return {
    type: REORDER_CONTEXT_WIDGET,
    graphql: {
      query: `mutation ($contextWidgetId: ID, $order: Int) {
        reorderContextWidget(contextWidgetId: $contextWidgetId, order: $order) {
          id
          order
          parentId
        }
      }`,
      variables: { contextWidgetId, order }
    },
    meta: {
      contextWidgetId,
      order,
      optimistic: true
    }
  }
}

export function removeWidgetFromMenu ({ contextWidgetId, groupId }) {
  return {
    type: REMOVE_WIDGET_FROM_MENU,
    graphql: {
      query: `mutation ($contextWidgetId: ID, $groupId: ID) {
        removeWidgetFromMenu(contextWidgetId: $contextWidgetId, groupId: $groupId) {
          success
        }
      }`,
      variables: { contextWidgetId, groupId }
    },
    meta: {
      contextWidgetId,
      groupId,
      optimistic: true
    }
  }
}

export function setHomeWidget ({ contextWidgetId, groupId }) {
  return {
    type: SET_HOME_WIDGET,
    graphql: {
      query: `mutation ($contextWidgetId: ID, $groupId: ID) {
        setHomeWidget(contextWidgetId: $contextWidgetId, groupId: $groupId) {
          success
        }
      }`,
      variables: { contextWidgetId, groupId }
    },
    meta: {
      contextWidgetId,
      groupId,
      optimistic: true
    }
  }
}
