// The purpose of this reducer is to provide a general-purpose store for keeping
// track of the ordering of lists of data fetched from the API.
//
// For example, the Members component will want to track the order of Members
// to show when the sort order is set to 'Name' separately from when it is set
// to 'Location'. And both of these lists are different from what should be
// shown when something has been typed into the search field.
import { get, isNull, omitBy, pick, reduce, uniq, isEmpty, includes } from 'lodash/fp'
import orm from 'store/models'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { FETCH_POSTS } from 'store/constants'
import {
  RECEIVE_POST
} from 'components/SocketListener/SocketListener.store'

// reducer

export default function (state = {}, action) {
  const { type, payload, error, meta } = action
  if (error) return state

  const { extractQueryResults } = meta || {}
  if (extractQueryResults && payload) {
    const { getItems, getRouteParams, getType, replace } = extractQueryResults
    return updateIds(state,
      getType ? getType(action) : action.type,
      getRouteParams ? getRouteParams(action) : meta.graphql.variables,
      getItems(action),
      replace
    )
  }

  // Purpose of this reducer:
  //   Ordering and subsets of ReduxORM data
  //

  switch (type) {
    case RECEIVE_POST: {
      return matchNewPostIntoQueryResults(state, payload.data.post)
    }
  }

  return state
}

export function matchNewPostIntoQueryResults (state, { id, isPublic, type, groups, topics = [] }) {
  /* about this:
      we add the post id into queryResult sets that are based on time of
      creation because we know that the post just created is the latest
      so we can prepend it. we have to match the different variations which
      can be implicit or explicit about sorting by 'updated'.
  */
  const queriesToMatch = []

  // All Groups stream w/ topics
  queriesToMatch.push({ context: 'all' })
  for (const topic of topics) {
    queriesToMatch.push(
      { context: 'all', topic: topic.id }
    )
  }

  // Public posts stream
  if (isPublic) {
    queriesToMatch.push({ context: 'public' })
  }

  // Group streams
  return reduce((memo, group) => {
    queriesToMatch.push(
      { context: 'groups', slug: group.slug },
      { context: 'groups', slug: group.slug, groupSlugs: [group.slug] }, // For FETCH_POSTS_MAP
      { context: 'groups', slug: group.slug, filter: type },
      { context: 'groups', slug: group.slug, sortBy: 'updated' },
      { context: 'groups', slug: group.slug, sortBy: 'updated', search: '', groupSlugs: [group.slug] }, // For FETCH_POSTS_MAP_DRAWER
      { context: 'groups', slug: group.slug, sortBy: 'updated', filter: type },
      { context: 'groups', slug: group.slug, sortBy: 'created' },
      { context: 'groups', slug: group.slug, sortBy: 'created', search: '', groupSlugs: [group.slug] }, // For FETCH_POSTS_MAP_DRAWER
      { context: 'groups', slug: group.slug, sortBy: 'created', filter: type },
      // For events stream
      { context: 'groups', slug: group.slug, sortBy: 'start_time', filter: type, order: 'asc' },
      { context: 'groups', slug: group.slug, sortBy: 'start_time', filter: type, order: 'desc' }
    )
    for (const topic of topics) {
      queriesToMatch.push(
        { context: 'groups', slug: group.slug, topic: topic.id }
      )
    }

    return reduce((innerMemo, params) => {
      return prependIdForCreate(innerMemo, FETCH_POSTS, params, id)
    }, memo, queriesToMatch)
  }, state, groups)
}

function prependIdForCreate (state, type, params, id) {
  const key = buildKey(type, params)
  if (!state[key]) return state
  return {
    ...state,
    [key]: {
      ids: !state[key].ids.includes(id) ? [id].concat(state[key].ids) : state[key].ids,
      total: state[key].total && state[key].total + 1,
      hasMore: state[key].hasMore
    }
  }
}

// If replace is false add new ids to the existing list, if true then replace list
function updateIds (state, type, params, data, replace = false) {
  if (!data) return state
  const { items = [], total, hasMore } = data
  const key = buildKey(type, params)
  const existingIds = get('ids', state[key]) || []
  const newIds = items.map(x => x.id)
  return {
    ...state,
    [key]: {
      ids: replace ? newIds : uniq(existingIds.concat(newIds)),
      total,
      hasMore
    }
  }
}

// selector factory

export function makeGetQueryResults (actionType) {
  return (state, props) => {
    // TBD: Sometimes parameters like 'id' and 'groupSlug' are to be found in the
    // URL, in which case they are in e.g. props.match.params.id; and sometimes
    // they are passed directly to a component. Should buildKey handle both
    // cases?
    const key = buildKey(actionType, props)
    // NOTE: cannot use lodash.get here because boundingBox string includes [, ] and . characters which are special in get
    return state.queryResults ? state.queryResults[key] : null
  }
}

// action factory

export function buildKey (type, params) {
  return JSON.stringify({
    type,
    params: omitBy(isNull, pick(queryParamWhitelist, params))
  })
}

export const queryParamWhitelist = [
  'autocomplete',
  'activePostsOnly',
  'announcementsOnly',
  'id',
  'commentId',
  'context',
  'childPostInclusion',
  'collectionToFilterOut',
  'createdBy',
  'farmQuery',
  'filter',
  'forCollection',
  'groupSlug',
  'groupSlugs',
  'groupType',
  'interactedWithBy',
  'isPublic',
  'mentionsOf',
  'order',
  'page',
  'parentSlugs',
  'postId',
  'search',
  'slug',
  'sortBy',
  'topic',
  'type', // TODO: why do we have type & filter? should only need one
  'types',
  'page',
  'nearCoord'
]

export function makeQueryResultsModelSelector (resultsSelector, modelName, transform = i => i) {
  return ormCreateSelector(
    orm,
    resultsSelector,
    (session, results) => {
      if (isEmpty(results) || isEmpty(results.ids)) return []
      return session[modelName].all()
        .filter(x => includes(x.id, results.ids))
        .orderBy(x => results.ids.indexOf(x.id))
        .toModelArray()
        .map(transform)
    })
}
