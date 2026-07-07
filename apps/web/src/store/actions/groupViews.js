import { get } from 'lodash/fp'
import {
  CREATE_GROUP_VIEW,
  CREATE_SPACE,
  DELETE_GROUP_VIEW,
  REORDER_GROUP_VIEW,
  SET_HOME_VIEW,
  UPDATE_GROUP_VIEW,
  UPDATE_SPACE
} from 'store/constants'

const groupViewFields = `
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
    slug
    avatarUrl
    homeRoute
    description
    groupViews {
      items {
        id
        type
        name
        order
        icon
        newPostCount
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
  }
`

/** Create a new view in a group's menu. */
export function createGroupView ({ groupId, type, name, icon, settings, link, pageContent, topics, orderInFrontOfViewId, addToEnd, linkedGroupId, postId, userId }) {
  return {
    type: CREATE_GROUP_VIEW,
    graphql: {
      query: `mutation ($groupId: ID!, $type: String!, $name: String, $icon: String, $settings: JSON, $link: String, $pageContent: String, $topics: [String], $orderInFrontOfViewId: ID, $addToEnd: Boolean, $linkedGroupId: ID, $postId: ID, $userId: ID) {
        createGroupView(
          groupId: $groupId
          type: $type
          name: $name
          icon: $icon
          settings: $settings
          link: $link
          pageContent: $pageContent
          topics: $topics
          orderInFrontOfViewId: $orderInFrontOfViewId
          addToEnd: $addToEnd
          linkedGroupId: $linkedGroupId
          postId: $postId
          userId: $userId
        ) {
          ${groupViewFields}
        }
      }`,
      variables: { groupId, type, name, icon, settings, link, pageContent, topics, orderInFrontOfViewId, addToEnd, linkedGroupId, postId, userId }
    },
    meta: {
      groupId,
      extractModel: [
        { getRoot: get('createGroupView'), modelName: 'GroupView' },
        { getRoot: get('createGroupView.linkedGroup'), modelName: 'Group' }
      ]
    }
  }
}

/** Update an existing group view. */
export function updateGroupView ({ id, name, icon, settings, link, pageContent, topics, orderInFrontOfViewId, addToEnd }) {
  return {
    type: UPDATE_GROUP_VIEW,
    graphql: {
      query: `mutation ($id: ID!, $name: String, $icon: String, $settings: JSON, $link: String, $pageContent: String, $topics: [String], $orderInFrontOfViewId: ID, $addToEnd: Boolean) {
        updateGroupView(
          id: $id
          name: $name
          icon: $icon
          settings: $settings
          link: $link
          pageContent: $pageContent
          topics: $topics
          orderInFrontOfViewId: $orderInFrontOfViewId
          addToEnd: $addToEnd
        ) {
          ${groupViewFields}
        }
      }`,
      variables: { id, name, icon, settings, link, pageContent, topics, orderInFrontOfViewId, addToEnd }
    },
    meta: {
      id,
      extractModel: [
        { getRoot: get('updateGroupView'), modelName: 'GroupView' },
        { getRoot: get('updateGroupView.linkedGroup'), modelName: 'Group' }
      ]
    }
  }
}

/** Remove a view from the menu. */
export function deleteGroupView (id, groupId) {
  return {
    type: DELETE_GROUP_VIEW,
    graphql: {
      query: `mutation ($id: ID!) {
        deleteGroupView(id: $id) {
          success
        }
      }`,
      variables: { id }
    },
    meta: { id, groupId }
  }
}

/** Reorder a view within its group's menu. */
export function reorderGroupView ({ id, orderInFrontOfViewId, addToEnd, parentGroupId, targetGroupId, reorderedItems }) {
  return {
    type: REORDER_GROUP_VIEW,
    graphql: {
      query: `mutation ($id: ID!, $orderInFrontOfViewId: ID, $addToEnd: Boolean) {
        reorderGroupView(id: $id, orderInFrontOfViewId: $orderInFrontOfViewId, addToEnd: $addToEnd) {
          success
        }
      }`,
      variables: { id, orderInFrontOfViewId, addToEnd }
    },
    meta: { id, parentGroupId, targetGroupId, reorderedItems }
  }
}

/** Set a view as the group's home view (order 0) and update home_route. */
export function setHomeView ({ viewId, groupId, parentGroupId, targetGroupId, reorderedItems }) {
  return {
    type: SET_HOME_VIEW,
    graphql: {
      query: `mutation ($viewId: ID!, $groupId: ID!) {
        setHomeView(viewId: $viewId, groupId: $groupId) {
          success
        }
      }`,
      variables: { viewId, groupId }
    },
    meta: { viewId, groupId, parentGroupId, targetGroupId, reorderedItems }
  }
}

/** Create a child space under a parent group. */
export function createSpace ({ parentGroupId, name, slug, description, icon, acceptedPostTypes }) {
  return {
    type: CREATE_SPACE,
    graphql: {
      query: `mutation ($parentGroupId: ID!, $name: String!, $slug: String, $description: String, $icon: String, $acceptedPostTypes: [String]) {
        createSpace(
          parentGroupId: $parentGroupId
          name: $name
          slug: $slug
          description: $description
          icon: $icon
          acceptedPostTypes: $acceptedPostTypes
        ) {
          id
          name
          slug
          homeRoute
          description
        }
      }`,
      variables: { parentGroupId, name, slug, description, icon, acceptedPostTypes }
    },
    meta: {
      parentGroupId,
      extractModel: [
        { getRoot: get('createSpace'), modelName: 'Group' }
      ]
    }
  }
}

/** Update a space's settings. */
export function updateSpace ({ id, name, slug, description, icon, acceptedPostTypes }) {
  return {
    type: UPDATE_SPACE,
    graphql: {
      query: `mutation ($id: ID!, $name: String, $slug: String, $description: String, $icon: String, $acceptedPostTypes: [String]) {
        updateSpace(
          id: $id
          name: $name
          slug: $slug
          description: $description
          icon: $icon
          acceptedPostTypes: $acceptedPostTypes
        ) {
          id
          name
          slug
          homeRoute
          description
        }
      }`,
      variables: { id, name, slug, description, icon, acceptedPostTypes }
    },
    meta: {
      id,
      extractModel: [
        { getRoot: get('updateSpace'), modelName: 'Group' }
      ]
    }
  }
}
