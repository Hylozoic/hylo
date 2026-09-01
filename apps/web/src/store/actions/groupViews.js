import { get, isUndefined, omitBy } from 'lodash/fp'
import {
  ADD_POST_TO_VIEW,
  CREATE_GROUP_VIEW,
  CREATE_SPACE,
  DELETE_GROUP_VIEW,
  DELETE_SPACE,
  ARCHIVE_SPACE,
  FETCH_VIEW_POSTS,
  REMOVE_POST_FROM_VIEW,
  REORDER_GROUP_VIEW,
  REORDER_VIEW_POST,
  SET_GROUP_VIEW_HIDDEN,
  SET_HOME_VIEW,
  UPDATE_GROUP_VIEW,
  UPDATE_SPACE
} from 'store/constants'
import { PostFieldsFragment } from 'store/actions/trackActions'

/** Build embedded menu patch fields from updateGroupView mutation args. */
function groupViewMenuData ({ name, icon, settings, link, pageContent, topics }) {
  return omitBy(isUndefined, { name, icon, settings, link, pageContent, topics })
}

/** Coerce GraphQL role ids (strings) to ints for createSpace/updateSpace `[Int]` variables. */
function toIntRoleIds (ids) {
  if (ids == null) return ids
  return ids.map(id => parseInt(id, 10)).filter(Number.isInteger)
}

/** Build embedded menu patch fields for a space view row from updateSpace args. */
function spaceViewMenuData ({ name, description, viewName, icon }) {
  const linkedGroup = omitBy(isUndefined, { name, description, icon })
  return omitBy(isUndefined, {
    name: viewName,
    linkedGroup: Object.keys(linkedGroup).length ? linkedGroup : undefined
  })
}

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
    slug
    avatarUrl
    icon
    homeRoute
    menuViewCount
    description
    groupViews {
      items {
        id
        type
        name
        order
        icon
        settings
        newPostCount
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
      }
    }
  }
`

/** Create a new view in a group's menu (or off-menu when hidden is true). */
export function createGroupView ({ groupId, type, name, icon, settings, link, pageContent, topics, orderInFrontOfViewId, addToEnd, linkedGroupId, postId, userId, hidden }) {
  return {
    type: CREATE_GROUP_VIEW,
    graphql: {
      query: `mutation ($groupId: ID!, $type: String!, $name: String, $icon: String, $settings: JSON, $link: String, $pageContent: String, $topics: [String], $orderInFrontOfViewId: ID, $addToEnd: Boolean, $linkedGroupId: ID, $postId: ID, $userId: ID, $hidden: Boolean) {
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
          hidden: $hidden
        ) {
          ${groupViewFields}
        }
      }`,
      variables: { groupId, type, name, icon, settings, link, pageContent, topics, orderInFrontOfViewId, addToEnd, linkedGroupId, postId, userId, hidden }
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
export function updateGroupView ({ id, groupId, name, icon, settings, link, pageContent, topics, orderInFrontOfViewId, addToEnd }) {
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
      variables: omitBy(isUndefined, { id, name, icon, settings, link, pageContent, topics, orderInFrontOfViewId, addToEnd })
    },
    meta: {
      id,
      groupId,
      data: groupViewMenuData({ name, icon, settings, link, pageContent, topics }),
      optimistic: true,
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

/** Hide (order = null) or show a view in the group's menu. */
export function setGroupViewHidden ({ id, groupId, hidden }) {
  return {
    type: SET_GROUP_VIEW_HIDDEN,
    graphql: {
      query: `mutation ($id: ID!, $hidden: Boolean!) {
        setGroupViewHidden(id: $id, hidden: $hidden) {
          ${groupViewFields}
        }
      }`,
      variables: { id, hidden }
    },
    meta: {
      id,
      groupId,
      hidden,
      optimistic: true,
      extractModel: [
        { getRoot: get('setGroupViewHidden'), modelName: 'GroupView' },
        { getRoot: get('setGroupViewHidden.linkedGroup'), modelName: 'Group' }
      ]
    }
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

/** Add a post to a collection (or other ordered) GroupView. */
export function addPostToView ({ groupId, viewId, postId, order, post }) {
  return {
    type: ADD_POST_TO_VIEW,
    graphql: {
      query: `mutation ($viewId: ID!, $postId: ID!, $order: Int) {
        addPostToView(viewId: $viewId, postId: $postId, order: $order) {
          id
          order
          post {
            id
            title
          }
        }
      }`,
      variables: { viewId, postId, order }
    },
    meta: { groupId, viewId, postId, order, post, optimistic: true }
  }
}

/** Remove a post from a collection (or other ordered) GroupView. */
export function removePostFromView ({ groupId, viewId, postId }) {
  return {
    type: REMOVE_POST_FROM_VIEW,
    graphql: {
      query: `mutation ($viewId: ID!, $postId: ID!) {
        removePostFromView(viewId: $viewId, postId: $postId) {
          success
        }
      }`,
      variables: { viewId, postId }
    },
    meta: { groupId, viewId, postId, optimistic: true }
  }
}

/** Reorder a post within a view's ordered collection (e.g. a track's Actions list). */
export function reorderViewPost ({ groupId, viewId, postId, order }) {
  return {
    type: REORDER_VIEW_POST,
    graphql: {
      query: `mutation ($viewId: ID!, $postId: ID!, $order: Int!) {
        reorderViewPost(viewId: $viewId, postId: $postId, order: $order) {
          success
        }
      }`,
      variables: { viewId, postId, order }
    },
    meta: { groupId, viewId, postId, order, optimistic: true }
  }
}

/**
 * Fetch the ordered posts for a view (e.g. a track's Actions list or a
 * funding round's Submissions list), sourced from collections_posts.
 * Merged directly onto the matching view in the group's menu, so it doesn't
 * clobber the rest of the (separately-fetched) groupViews menu data.
 */
export function fetchViewPosts (groupId, viewId) {
  return {
    type: FETCH_VIEW_POSTS,
    graphql: {
      query: `query ($groupId: ID) {
        group(id: $groupId) {
          id
          groupViews {
            items {
              id
              collectionPosts {
                ${PostFieldsFragment}
              }
            }
          }
        }
      }`,
      variables: { groupId }
    },
    meta: { groupId, viewId }
  }
}

/** Create a child space under a parent group. */
export function createSpace ({ parentGroupId, name, slug, description, icon, acceptedPostTypes, purpose, location, locationId, visibility, accessibility, requiredRoles, viewTypes, bannerUrl, avatarUrl, paywall, addToMenu, status }) {
  return {
    type: CREATE_SPACE,
    graphql: {
      query: `mutation ($parentGroupId: ID!, $name: String!, $slug: String, $description: String, $icon: String, $acceptedPostTypes: [String], $purpose: String, $location: String, $locationId: ID, $visibility: Int, $accessibility: Int, $requiredRoles: [Int], $viewTypes: [String], $bannerUrl: String, $avatarUrl: String, $paywall: Boolean, $addToMenu: Boolean, $status: GroupStatus) {
        createSpace(
          parentGroupId: $parentGroupId
          name: $name
          slug: $slug
          description: $description
          icon: $icon
          acceptedPostTypes: $acceptedPostTypes
          purpose: $purpose
          location: $location
          locationId: $locationId
          visibility: $visibility
          accessibility: $accessibility
          requiredRoles: $requiredRoles
          viewTypes: $viewTypes
          bannerUrl: $bannerUrl
          avatarUrl: $avatarUrl
          paywall: $paywall
          addToMenu: $addToMenu
          status: $status
        ) {
          id
          name
          slug
          homeRoute
          menuViewCount
          description
          bannerUrl
          avatarUrl
          paywall
          visibility
          accessibility
          status
          active
        }
      }`,
      variables: { parentGroupId, name, slug, description, icon, acceptedPostTypes, purpose, location, locationId, visibility, accessibility, requiredRoles: toIntRoleIds(requiredRoles), viewTypes, bannerUrl, avatarUrl, paywall, addToMenu, status }
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
export function updateSpace ({ id, groupId, spaceViewId, name, slug, description, icon, acceptedPostTypes, viewName, purpose, location, locationId, visibility, accessibility, requiredRoles, bannerUrl, avatarUrl, paywall, status }) {
  return {
    type: UPDATE_SPACE,
    graphql: {
      query: `mutation ($id: ID!, $name: String, $slug: String, $description: String, $icon: String, $acceptedPostTypes: [String], $purpose: String, $location: String, $locationId: ID, $visibility: Int, $accessibility: Int, $requiredRoles: [Int], $bannerUrl: String, $avatarUrl: String, $paywall: Boolean, $status: GroupStatus) {
        updateSpace(
          id: $id
          name: $name
          slug: $slug
          description: $description
          icon: $icon
          acceptedPostTypes: $acceptedPostTypes
          purpose: $purpose
          location: $location
          locationId: $locationId
          visibility: $visibility
          accessibility: $accessibility
          requiredRoles: $requiredRoles
          bannerUrl: $bannerUrl
          avatarUrl: $avatarUrl
          paywall: $paywall
          status: $status
        ) {
          id
          name
          slug
          homeRoute
          menuViewCount
          description
          bannerUrl
          avatarUrl
          paywall
          visibility
          accessibility
          acceptedPostTypes
          icon
          status
          active
        }
      }`,
      variables: omitBy(isUndefined, { id, name, slug, description, icon, acceptedPostTypes, purpose, location, locationId, visibility, accessibility, requiredRoles: toIntRoleIds(requiredRoles), bannerUrl, avatarUrl, paywall, status })
    },
    meta: {
      id,
      groupId,
      spaceViewId,
      acceptedPostTypes,
      data: spaceViewMenuData({ name, description, viewName, icon }),
      optimistic: true,
      extractModel: [
        { getRoot: get('updateSpace'), modelName: 'Group' }
      ]
    }
  }
}

export function archiveSpace (id) {
  return {
    type: ARCHIVE_SPACE,
    graphql: {
      query: `mutation ($id: ID!) {
        archiveSpace(id: $id) {
          id
          status
          active
        }
      }`,
      variables: { id }
    },
    meta: {
      id,
      extractModel: 'Group'
    }
  }
}

export function deleteSpace (id) {
  return {
    type: DELETE_SPACE,
    graphql: {
      query: `mutation ($id: ID!) {
        deleteSpace(id: $id) {
          success
        }
      }`,
      variables: { id }
    },
    meta: { id }
  }
}
