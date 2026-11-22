import { get } from 'lodash/fp'
import { CREATE_USER_PROFILE_LINK, UPDATE_USER_PROFILE_LINK, DELETE_USER_PROFILE_LINK, REORDER_USER_PROFILE_LINKS } from 'store/constants'

export function createUserProfileLink ({ url, title }) {
  return {
    type: CREATE_USER_PROFILE_LINK,
    graphql: {
      query: `mutation ($url: String, $title: String) {
        createUserProfileLink(data: { url: $url, title: $title }) {
          id
          url
          title
          iconUrl
          sortOrder
          createdAt
          updatedAt
        }
      }`,
      variables: { url, title }
    },
    meta: {
      extractModel: {
        modelName: 'UserProfileLink',
        getRoot: get('createUserProfileLink')
      },
      optimistic: true
    }
  }
}

export function updateUserProfileLink ({ id, url, title }) {
  return {
    type: UPDATE_USER_PROFILE_LINK,
    graphql: {
      query: `mutation ($id: ID, $url: String, $title: String) {
        updateUserProfileLink(id: $id, data: { url: $url, title: $title }) {
          id
          url
          title
          iconUrl
          sortOrder
          createdAt
          updatedAt
        }
      }`,
      variables: { id, url, title }
    },
    meta: {
      extractModel: {
        modelName: 'UserProfileLink',
        getRoot: get('updateUserProfileLink')
      }
    }
  }
}

export function reorderUserProfileLinks (ids) {
  return {
    type: REORDER_USER_PROFILE_LINKS,
    graphql: {
      query: `mutation ($ids: [ID!]!) {
        reorderUserProfileLinks(ids: $ids) {
          id
          url
          title
          iconUrl
          sortOrder
          createdAt
          updatedAt
        }
      }`,
      variables: { ids }
    },
    meta: {
      extractModel: 'UserProfileLink'
    }
  }
}

export function deleteUserProfileLink (id) {
  return {
    type: DELETE_USER_PROFILE_LINK,
    graphql: {
      query: `mutation ($id: ID) {
        deleteUserProfileLink(id: $id)
      }`,
      variables: { id }
    },
    meta: {
      id,
      optimistic: true
    }
  }
}
