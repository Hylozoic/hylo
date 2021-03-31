import { AnalyticsEvents } from 'hylo-utils/constants'

export const MODULE_NAME = 'CreateGroupFlow'
export const SAVE_GROUP_NAME = `${MODULE_NAME}/SAVE_GROUP_NAME`
export const SAVE_GROUP_URL = `${MODULE_NAME}/SAVE_GROUP_URL`
export const SAVE_GROUP_VISIBILITY_ACCESSIBILITY = `${MODULE_NAME}/SAVE_GROUP_VISIBILITY_ACCESSIBILITY`
export const SAVE_GROUP_PARENT_GROUP_IDS = `${MODULE_NAME}/SAVE_GROUP_PARENT_GROUP_IDS`
export const FETCH_URL_EXISTS = `${MODULE_NAME}/FETCH_URL_EXISTS`
export const CREATE_GROUP = `${MODULE_NAME}/CREATE_GROUP`
export const CLEAR_CREATE_GROUP_STORE = `${MODULE_NAME}/CLEAR_CREATE_GROUP_STORE`
export const FETCH_GROUP_EXISTS = `${MODULE_NAME}/FETCH_URL_EXISTS`

export default function reducer (state = {}, action) {
  const { type, payload } = action
  switch (type) {
    case SAVE_GROUP_NAME:
      return {
        ...state,
        groupName: payload
      }
    case SAVE_GROUP_URL:
      return {
        ...state,
        groupUrl: payload
      }
    case SAVE_GROUP_VISIBILITY_ACCESSIBILITY:
      return {
        ...state,
        visibilityAccessibility: payload
      }
    case SAVE_GROUP_PARENT_GROUP_IDS:
      return {
        ...state,
        parentGroupIds: payload
      }
    case CLEAR_CREATE_GROUP_STORE:
      return {
        ...state,
        groupUrl: null,
        groupName: null
      }
    case FETCH_URL_EXISTS:
      return {
        ...state,
        urlExists: action.payload.data.groupExists.exists
      }
  }
  return state
}

export function createGroup (name, slug) {
  return {
    type: CREATE_GROUP,
    graphql: {
      query: `mutation ($data: GroupInput) {
        createGroup(data: $data) {
          id
          hasModeratorRole
          group {
            id
            name
            slug
          }
        }
      }
      `,
      variables: {
        data: {
          name,
          slug
        }
      }
    },
    meta: {
      extractModel: 'Membership',
      slug,
      name,
      analytics: AnalyticsEvents.GROUP_CREATED
    }
  }
}

export function fetchGroupExists (slug) {
  return {
    type: FETCH_GROUP_EXISTS,
    graphql: {
      query: `
        query ($slug: String) {
          groupExists (slug: $slug) {
            exists
          }
        }
      `,
      variables: {
        slug
      }
    }
  }
}

export function saveGroupName (name) {
  return {
    type: SAVE_GROUP_NAME,
    payload: name
  }
}

export function saveGroupUrl (url) {
  return {
    type: SAVE_GROUP_URL,
    payload: url
  }
}

export function saveGroupVisibilityAccessibility (visibilityAccessibility) {
  return {
    type: SAVE_GROUP_VISIBILITY_ACCESSIBILITY,
    payload: visibilityAccessibility
  }
}

export function saveGroupParentGroupIds (parentGroupIds) {
  return {
    type: SAVE_GROUP_PARENT_GROUP_IDS,
    payload: parentGroupIds
  }
}

export function clearCreateGroupStore () {
  return {
    type: CLEAR_CREATE_GROUP_STORE
  }
}

export function getGroupName (state) {
  return state[MODULE_NAME].groupName
}

export function getGroupUrl (state) {
  return state[MODULE_NAME].groupUrl
}

export function getGroupUrlExists (state) {
  return state[MODULE_NAME].urlExists
}
