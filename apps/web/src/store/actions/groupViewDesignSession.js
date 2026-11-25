export const FETCH_GROUP_VIEW_DESIGN_SESSION = 'FETCH_GROUP_VIEW_DESIGN_SESSION'
export const SAVE_GROUP_VIEW_DESIGN_SESSION = 'SAVE_GROUP_VIEW_DESIGN_SESSION'
export const DELETE_GROUP_VIEW_DESIGN_SESSION = 'DELETE_GROUP_VIEW_DESIGN_SESSION'
// The server's error code for a change made against an older version of the session
export const DESIGN_SESSION_CHANGED = 'DESIGN_SESSION_CHANGED'

/**
 * The stored "Design your own view" session for a designed view, or for the page not added to the
 * menu yet when viewId is null, shared by the group's stewards: payload.data.groupViewDesignSession
 * is { messages, draft, version, updatedAt, updatedById, authors } or null.
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
 * version is the session's version this browser last saw (null when it saw none); if another
 * steward changed it since, the server refuses with DESIGN_SESSION_CHANGED.
 */
export function saveGroupViewDesignSession (groupId, viewId = null, messages = [], draft = null, version = null) {
  return {
    type: SAVE_GROUP_VIEW_DESIGN_SESSION,
    graphql: {
      query: `mutation SaveGroupViewDesignSession ($groupId: ID!, $viewId: ID, $messages: JSON, $draft: JSON, $version: Int) {
        saveGroupViewDesignSession(groupId: $groupId, viewId: $viewId, messages: $messages, draft: $draft, version: $version)
      }`,
      variables: { groupId, viewId, messages, draft, version }
    },
    meta: { groupId, viewId }
  }
}

/**
 * Forgets the session; with version, only if no other steward has changed it since.
 */
export function deleteGroupViewDesignSession (groupId, viewId = null, version = null) {
  return {
    type: DELETE_GROUP_VIEW_DESIGN_SESSION,
    graphql: {
      query: `mutation DeleteGroupViewDesignSession ($groupId: ID!, $viewId: ID, $version: Int) {
        deleteGroupViewDesignSession(groupId: $groupId, viewId: $viewId, version: $version) { success }
      }`,
      variables: { groupId, viewId, version }
    },
    meta: { groupId, viewId }
  }
}
