import { createSelector as ormCreateSelector } from 'redux-orm'
import { createSelector } from 'reselect'
import orm from 'store/models'
import { isEmpty, includes, get } from 'lodash/fp'
import { buildKey, makeGetQueryResults } from 'store/reducers/queryResults'
import postFieldsFragment from '@graphql/fragments/postFieldsFragment'
import presentPost from 'store/presenters/presentPost'
import presentComment from 'store/presenters/presentComment'

export const MODULE_NAME = 'Search'

const defaultState = {}

function getQueryVariables (action) {
  return action.meta?.graphql?.variables || {}
}

function isHtml (value) {
  return typeof value === 'string' && /^\s*</.test(value)
}

/** Returns a user-facing search error message from a failed query payload */
export function formatSearchErrorMessage (error, t) {
  if (!error) return null

  const genericMessage = t('Oh no, something went wrong! Check your internet connection and try again')

  const tryParseMessage = (value) => {
    if (typeof value !== 'string' || isHtml(value)) return null
    try {
      const parsed = JSON.parse(value)
      return parsed.error || parsed.message || null
    } catch (e) {
      return value
    }
  }

  return tryParseMessage(get('response.body', error)) ||
    tryParseMessage(error.message) ||
    genericMessage
}

export default function reducer (state = defaultState, action) {
  if (action.type === FETCH_SEARCH + '_PENDING') {
    const key = buildKey(FETCH_SEARCH, getQueryVariables(action))
    if (!state[key]) return state
    const { [key]: _, ...rest } = state
    return rest
  }

  if (action.type === FETCH_SEARCH) {
    const key = buildKey(FETCH_SEARCH, getQueryVariables(action))
    if (action.error) {
      return { ...state, [key]: action.payload }
    }
    if (state[key]) {
      const { [key]: _, ...rest } = state
      return rest
    }
  }

  return state
}

export const SET_SEARCH_TERM = `${MODULE_NAME}/SET_SEARCH_TERM`
export const SET_SEARCH_FILTER = `${MODULE_NAME}/SET_SEARCH_FILTER`
export const FETCH_SEARCH = `${MODULE_NAME}/FETCH_SEARCH`

// Actions

const searchQuery =
`query Search ($search: String, $type: String, $offset: Int, $groupIds: [ID]) {
  search(term: $search, first: 10, type: $type, offset: $offset, groupIds: $groupIds ) {
    total
    hasMore
    items {
      id
      content {
        __typename
        ... on Person {
          id
          name
          location
          avatarUrl
          skills {
            items {
              id
              name
            }
          }
        }
        ... on Post {
          ${postFieldsFragment(false)}
        }
        ... on Comment {
          id
          text
          createdAt
          creator {
            id
            name
            avatarUrl
          }
          post {
            ${postFieldsFragment(false)}
          }
          attachments {
            type
            url
            position
            id
          }
        }
      }
    }
  }
}`

export function fetchSearchResults ({ search, offset = 0, filter, query = searchQuery, groupIds = null }) {
  return {
    type: FETCH_SEARCH,
    graphql: {
      query,
      variables: {
        groupIds,
        search,
        offset,
        type: filter
      }
    },
    meta: {
      extractModel: 'SearchResult',
      extractQueryResults: {
        getItems: get('payload.data.search')
      }
    }
  }
}

// Selectors

const getSearchResultResults = makeGetQueryResults(FETCH_SEARCH)

export function presentSearchResult (searchResult, session) {
  const contentRaw = searchResult.getContent(session)
  const type = contentRaw.constructor.modelName

  let content = contentRaw

  if (type === 'Post') {
    content = presentPost(content)
  }

  if (type === 'Person') {
    content = {
      ...content.ref,
      skills: content.skills.toModelArray()
    }
  }

  if (type === 'Comment') {
    content = presentComment(content)
  }

  return {
    ...searchResult.ref,
    content,
    type
  }
}

export const getSearchResults = ormCreateSelector(
  orm,
  getSearchResultResults,
  (session, results) => {
    if (isEmpty(results) || isEmpty(results.ids)) return []
    return session.SearchResult.all()
      .filter(x => includes(x.id, results.ids))
      .orderBy(x => results.ids.indexOf(x.id))
      .toModelArray()
      .map(searchResults => presentSearchResult(searchResults, session))
  }
)

export const getHasMoreSearchResults = createSelector(getSearchResultResults, get('hasMore'))

export function getHasFetchedSearchResults (state, props) {
  return getSearchResultResults(state, props) != null
}

export function getSearchError (state, props) {
  const key = buildKey(FETCH_SEARCH, props)
  return state.Search?.[key]
}
