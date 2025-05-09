import { createSelector as ormCreateSelector } from 'redux-orm'
import { createSelector } from 'reselect'
import orm from 'store/models'
import { isEmpty, includes, get } from 'lodash/fp'
import { makeGetQueryResults } from 'store/reducers/queryResults'
import postFieldsFragment from '@graphql/fragments/postFieldsFragment'
import presentPost from 'store/presenters/presentPost'
import presentComment from 'store/presenters/presentComment'

export const MODULE_NAME = 'Search'

export const SET_SEARCH_TERM = `${MODULE_NAME}/SET_SEARCH_TERM`
export const SET_SEARCH_FILTER = `${MODULE_NAME}/SET_SEARCH_FILTER`
export const FETCH_SEARCH = `${MODULE_NAME}/FETCH_SEARCH`

// Actions

const searchQuery =
`query ($search: String, $type: String, $offset: Int) {
  search(term: $search, first: 10, type: $type, offset: $offset) {
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

export function fetchSearchResults ({ search, offset = 0, filter, query = searchQuery }) {
  return {
    type: FETCH_SEARCH,
    graphql: {
      query,
      variables: {
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
