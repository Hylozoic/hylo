import {
  makeGetQueryResults, makeQueryResultsModelSelector
} from 'store/reducers/queryResults'
import { createSelector } from 'reselect'
import { get } from 'lodash/fp'

export const MODULE_NAME = 'Members'

export const FETCH_MEMBERS = `${MODULE_NAME}/FETCH_MEMBERS`
export const SET_SORT = `${MODULE_NAME}/SET_SORT`
export const SET_SEARCH = `${MODULE_NAME}/SET_SEARCH`

export const groupMembersQuery = `
query ($slug: String, $first: Int, $sortBy: String, $offset: Int, $search: String) {
  group (slug: $slug) {
    id
    name
    avatarUrl
    bannerUrl
    memberCount
    members (first: $first, sortBy: $sortBy, offset: $offset, search: $search) {
      items {
        id
        name
        bio
        avatarUrl
        location
        locationObject {
          id
          addressNumber
          addressStreet
          bbox {
            lat
            lng
          }
          center {
            lat
            lng
          }
          city
          country
          fullText
          locality
          neighborhood
          region
        }
        tagline
        groupRoles {
          items {
            id
            name
            emoji
            active
            groupId
            responsibilities {
              items {
                id
                title
                description
              }
            }
          }
        }
        membershipCommonRoles {
          items {
            id
            commonRoleId
            groupId
            userId
          }
        }
        skills {
          hasMore
          items {
            id
            name
          }
        }
      }
      hasMore
    }
  }
}`

export function fetchGroupMembers (slug, sortBy, offset, search) {
  return {
    type: FETCH_MEMBERS,
    graphql: {
      query: groupMembersQuery,
      variables: { slug, first: 20, offset, sortBy, search }
    },
    meta: {
      extractModel: 'Group',
      extractQueryResults: {
        getItems: get('payload.data.group.members'),
        getParams: (action) => ({ ...get('meta.graphql.variables', action) })
      }
    }
  }
}

export const initialState = {
  search: '',
  sortBy: 'join'
}

export default function reducer (state = initialState, action) {
  const { error, type, payload } = action
  if (error) return state

  switch (type) {
    case SET_SEARCH:
      return {
        ...state,
        search: payload
      }
    case SET_SORT:
      return {
        ...state,
        sortBy: payload
      }
    default:
      return state
  }
}

export function getSearch (state) {
  return state[MODULE_NAME]?.search
}

export function setSearch (search) {
  return {
    type: SET_SEARCH,
    payload: search
  }
}

export function getSort (state) {
  return state[MODULE_NAME].sortBy
}

export function setSort (sortBy) {
  return {
    type: SET_SORT,
    payload: sortBy
  }
}

export function fetchMembers ({ slug, sortBy, offset, search }) {
  return fetchGroupMembers(slug, sortBy, offset, search)
}

const getMemberResults = makeGetQueryResults(FETCH_MEMBERS)

export const getMembers = makeQueryResultsModelSelector(
  getMemberResults,
  'Person',
  person => ({
    ...person.ref,
    skills: person.skills && person.skills.toModelArray()
  })
)

export const getHasMoreMembers = createSelector(
  getMemberResults,
  get('hasMore')
)
