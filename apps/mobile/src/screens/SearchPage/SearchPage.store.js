import orm from 'store/models'
import { gql } from 'urql'
import { createSelector } from 'reselect'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { get, isEmpty, includes } from 'lodash/fp'
import { makeGetQueryResults } from 'store/reducers/queryResults'
import postFieldsFragment from 'graphql/fragments/postFieldsFragment'

export const MODULE_NAME = 'SearchPage'

export const SET_SEARCH_TERM = `${MODULE_NAME}/SET_SEARCH_TERM`
export const SET_SEARCH_FILTER = `${MODULE_NAME}/SET_SEARCH_FILTER`
export const FETCH_SEARCH = `${MODULE_NAME}/FETCH_SEARCH`

export const initialState = {
  search: '',
  filter: 'all'
}

export default function reducer (state = initialState, action) {
  const { error, type, payload } = action

  if (error) return state

  switch (type) {
    case SET_SEARCH_TERM:
      return {
        ...state,
        search: payload
      }
    case SET_SEARCH_FILTER:
      return {
        ...state,
        filter: payload
      }
    default:
      return state
  }
}

export function setSearchTerm (search) {
  return {
    type: SET_SEARCH_TERM,
    payload: search
  }
}

export function setSearchFilter (filter) {
  return {
    type: SET_SEARCH_FILTER,
    payload: filter
  }
}

export function getSearchTerm (state) {
  return state[MODULE_NAME]?.search
}

export function getSearchFilter (state) {
  return state[MODULE_NAME]?.filter
}

export function fetchSearchResults ({ search, offset = 0, filter }) {
  return {
    type: FETCH_SEARCH,
    graphql: {
      query: gql`
        query ($search: String, $type: String, $offset: Int) {
          search(term: $search, first: 10, type: $type, offset: $offset) {
            total
            hasMore
            items {
              id
              content {
                contentTypeName: __typename
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
                  ...PostFieldsFragment
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
                    id
                    title
                    type
                    creator {
                      id
                      name
                      avatarUrl
                    }
                  }
                  attachments {
                    id
                    url
                    type
                  }
                }
              }
            }
          }
        }
        ${postFieldsFragment}
      `,
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

const getSearchResultResults = makeGetQueryResults(FETCH_SEARCH)

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

export function presentSearchResult (searchResult, session) {
  const contentRaw = searchResult.getContent(session)
  const type = contentRaw.constructor.modelName

  let content = contentRaw

  if (type === 'Post') {
    content = {
      ...content.ref,
      creator: content.creator,
      commenters: content.commenters.toModelArray(),
      groups: content.groups.toModelArray(),
      linkPreview: content.linkPreview,
      fileAttachments: content.attachments.filter(a => a.type === 'file').toModelArray()
    }
  }

  if (type === 'Person') {
    content = {
      ...content.ref,
      skills: content.skills.toModelArray()
    }
  }

  if (type === 'Comment') {
    const post = {
      ...content.post.ref,
      creator: content.post.creator
    }
    content = {
      ...content.ref,
      creator: content.creator,
      post,
      image: content.attachments.toModelArray()[0]
    }
  }

  return {
    ...searchResult.ref,
    content,
    type
  }
}
