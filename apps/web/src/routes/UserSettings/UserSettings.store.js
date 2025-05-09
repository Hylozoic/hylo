import {
  FETCH_SAVED_SEARCHES,
  DELETE_SAVED_SEARCH,
  SAVE_SEARCH,
  UNLINK_ACCOUNT,
  VIEW_SAVED_SEARCH
} from 'store/constants'
import CreateSavedSearchMutation from '@graphql/mutations/CreateSavedSearchMutation'

export const MODULE_NAME = 'UserSettings'

export const UPDATE_USER_SETTINGS = `${MODULE_NAME}/UPDATE_USER_SETTINGS`
export const UPDATE_USER_SETTINGS_PENDING = UPDATE_USER_SETTINGS + '_PENDING'
export const UPDATE_MEMBERSHIP_SETTINGS = `${MODULE_NAME}/UPDATE_MEMBERSHIP_SETTINGS`
export const UPDATE_MEMBERSHIP_SETTINGS_PENDING = UPDATE_MEMBERSHIP_SETTINGS + '_PENDING'
export const UPDATE_ALL_MEMBERSHIP_SETTINGS = `${MODULE_NAME}/UPDATE_ALL_MEMBERSHIP_SETTINGS`
export const UPDATE_ALL_MEMBERSHIP_SETTINGS_PENDING = `${UPDATE_ALL_MEMBERSHIP_SETTINGS}_PENDING`
export const REGISTER_STRIPE_ACCOUNT = `${MODULE_NAME}/REGISTER_STRIPE_ACCOUNT`

const defaultState = {
  searches: []
}

export default function reducer (state = defaultState, action) {
  const { error, type, payload } = action
  if (error) return state

  switch (type) {
    case FETCH_SAVED_SEARCHES:
      return {
        ...state,
        searches: payload.data.savedSearches.items
      }
    case DELETE_SAVED_SEARCH: {
      const deletedId = payload.data.deleteSavedSearch
      return {
        ...state,
        searches: state.searches.filter(s => s.id !== deletedId)
      }
    }
    case VIEW_SAVED_SEARCH: {
      const search = payload.search
      return {
        ...state,
        selectedSearch: search
      }
    }
    default:
      return state
  }
}

export function updateUserSettings (changes) {
  return {
    type: UPDATE_USER_SETTINGS,
    graphql: {
      query: `mutation ($changes: MeInput) {
        updateMe(changes: $changes) {
          id
        }
      }`,
      variables: {
        changes
      }
    },
    meta: {
      optimistic: true,
      changes
    }
  }
}

export function fetchSavedSearches (userId) {
  return {
    type: FETCH_SAVED_SEARCHES,
    graphql: {
      query: `query ($userId: ID) {
        savedSearches(userId: $userId) {
          total
          hasMore
          items {
            id
            name
            boundingBox
            createdAt
            context
            group {
              id
              name
              slug
            }
            isActive
            searchText
            topics {
              id
              name
            }
            postTypes
          }
        }
      }`,
      variables: { userId }
    }
  }
}

export function deleteSearch (id) {
  return {
    type: DELETE_SAVED_SEARCH,
    graphql: {
      query: `mutation ($id: ID) {
        deleteSavedSearch(id: $id)
      }`,
      variables: { id }
    },
    meta: {
      id,
      optimistic: true
    }
  }
}

export function saveSearch ({ boundingBox, groupSlug, context, name, postTypes, searchText, topicIds, userId }) {
  return {
    type: SAVE_SEARCH,
    graphql: {
      query: CreateSavedSearchMutation,
      variables: { boundingBox, groupSlug, context, name, postTypes, searchText, topicIds, userId }
    },
    meta: {
      boundingBox, groupSlug, context, name, postTypes, searchText, topicIds, userId, optimistic: true
    }
  }
}

export function viewSavedSearch (search) {
  return {
    type: VIEW_SAVED_SEARCH,
    payload: { search }
  }
}

export function unlinkAccount (provider) {
  return {
    type: UNLINK_ACCOUNT,
    graphql: {
      query: `mutation ($provider: String) {
        unlinkAccount(provider: $provider) {
          success
        }
      }`,
      variables: { provider }
    }
  }
}

export function updateMembershipSettings (groupId, settings, acceptAgreements = null, questionAnswers = []) {
  return {
    type: UPDATE_MEMBERSHIP_SETTINGS,
    graphql: {
      query: `
        mutation UpdateMembershipSettings ($groupId: ID, $data: MembershipInput) {
          updateMembership(groupId: $groupId, data: $data) {
            id
          }
        }
      `,
      variables: {
        data: {
          acceptAgreements,
          questionAnswers,
          settings
        },
        groupId
      }
    },
    meta: {
      groupId,
      acceptAgreements,
      settings,
      optimistic: true
    }
  }
}

export function updateAllMemberships (settings) {
  const query = `mutation UpdateAllMemberships ($data: MembershipInput) {
    updateAllMemberships(data: $data) {
      success
      error
    }
  }`
  return {
    type: UPDATE_ALL_MEMBERSHIP_SETTINGS,
    graphql: {
      query,
      variables: {
        data: {
          settings
        }
      }
    },
    meta: {
      settings,
      optimistic: true
    }
  }
}

export function registerStripeAccount (authorizationCode) {
  return {
    type: REGISTER_STRIPE_ACCOUNT,
    graphql: {
      query: `mutation ($authorizationCode: String) {
        registerStripeAccount(authorizationCode: $authorizationCode) {
          success
        }
      }`,
      variables: { authorizationCode }
    },
    meta: {
      authorizationCode
    }
  }
}
