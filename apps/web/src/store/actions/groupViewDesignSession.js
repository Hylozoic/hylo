export const FETCH_GROUP_VIEW_DESIGN_SESSION = 'FETCH_GROUP_VIEW_DESIGN_SESSION'
export const SAVE_GROUP_VIEW_DESIGN_SESSION = 'SAVE_GROUP_VIEW_DESIGN_SESSION'
export const DELETE_GROUP_VIEW_DESIGN_SESSION = 'DELETE_GROUP_VIEW_DESIGN_SESSION'

/**
 * The steward's stored "Design your own view" session for a designed view, or for the page not
 * added to the menu yet when viewId is null: payload.data.groupViewDesignSession is
 * { messages, draft, updatedAt } or null.
 */
export function fetchGroupViewDesignSession (groupId, viewId = null) {
  return {
    type: FETCH_GROUP_VIEW_DESIGN_SESSION,
    graphql: {
      query: `query GroupViewDesignSession ($groupId: ID!, $viewId: ID) {
        groupViewDesignSession(groupId: $groupId, viewId: $viewId)
      }`,
      variables: { groupId, viewId }
    },
    meta: { groupId, viewId }
  }
}

/**
 * Stores the session: messages is the chat with Axl, draft the unsaved page (null once saved).
 */
export function saveGroupViewDesignSession (groupId, viewId = null, messages = [], draft = null) {
  return {
    type: SAVE_GROUP_VIEW_DESIGN_SESSION,
    graphql: {
      query: `mutation SaveGroupViewDesignSession ($groupId: ID!, $viewId: ID, $messages: JSON, $draft: JSON) {
        saveGroupViewDesignSession(groupId: $groupId, viewId: $viewId, messages: $messages, draft: $draft)
      }`,
      variables: { groupId, viewId, messages, draft }
    },
    meta: { groupId, viewId }
  }
}

export function deleteGroupViewDesignSession (groupId, viewId = null) {
  return {
    type: DELETE_GROUP_VIEW_DESIGN_SESSION,
    graphql: {
      query: `mutation DeleteGroupViewDesignSession ($groupId: ID!, $viewId: ID) {
        deleteGroupViewDesignSession(groupId: $groupId, viewId: $viewId) { success }
      }`,
      variables: { groupId, viewId }
    },
    meta: { groupId, viewId }
  }
}
