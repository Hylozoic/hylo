import {
  CREATE_CONTEXT_WIDGET,
  UPDATE_CONTEXT_WIDGET,
  REORDER_CONTEXT_WIDGET,
  REMOVE_WIDGET_FROM_MENU
} from 'store/constants'

export function createContextWidget ({ groupId, data }) {
  return {
    type: CREATE_CONTEXT_WIDGET,
    graphql: {
      query: `mutation ($groupId: ID, $data: ContextWidgetInput) {
        createContextWidget(groupId: $groupId, data: $data) {
          id
          groupId
          title
          order
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

export function removeWidgetFromMenu ({ contextWidgetId }) {
  return {
    type: REMOVE_WIDGET_FROM_MENU,
    graphql: {
      query: `mutation ($contextWidgetId: ID) {
        removeWidgetFromMenu(contextWidgetId: $contextWidgetId) {
          success
        }
      }`,
      variables: { contextWidgetId }
    },
    meta: {
      contextWidgetId,
      optimistic: true
    }
  }
}
