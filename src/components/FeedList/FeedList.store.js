import { makeGetQueryResults } from 'store/reducers/queryResults'
import { FETCH_POSTS } from 'store/constants'
import { createSelector } from 'reselect'
import { get, isEmpty, isNull, isUndefined, omitBy } from 'lodash/fp'
import createCachedSelector from 're-reselect'

export const MODULE_NAME = 'FeedList'

export const SET_FILTER = `${MODULE_NAME}/SET_FILTER`
export const SET_SORT = `${MODULE_NAME}/SET_SORT`
export const SET_TIMEFRAME = `${MODULE_NAME}/SET_TIMEFRAME`

export const defaultFilter = null
export const defaultSortBy = 'updated'
export const defaultTimeframe = 'future'

export const defaultState = {
  filter: defaultFilter,
  sortBy: defaultSortBy,
  timeframe: defaultTimeframe
}

export default function reducer (state = defaultState, action) {
  const { error, type, payload } = action
  if (error) return state

  switch (type) {
    case SET_FILTER:
      return {
        ...state,
        filter: payload
      }
    case SET_SORT:
      return {
        ...state,
        sortBy: payload
      }
    case SET_TIMEFRAME:
      return {
        ...state,
        timeframe: payload
      }
    default:
      return state
  }
}

export function setFilter (filter) {
  return {
    type: SET_FILTER,
    payload: filter
  }
}

export function setSort (sortBy) {
  return {
    type: SET_SORT,
    payload: sortBy
  }
}

export function setTimeframe (timeframe) {
  return {
    type: SET_TIMEFRAME,
    payload: timeframe
  }
}

export function getFilter (state) {
  return state[MODULE_NAME].filter
}

export function getSort (state) {
  return state[MODULE_NAME].sortBy
}

export function getTimeframe (state) {
  return state[MODULE_NAME].timeframe
}

const getPostResults = makeGetQueryResults(FETCH_POSTS)

export const getPostIds = createSelector(
  getPostResults,
  results => isEmpty(results) ? [] : results.ids
)

export const getHasMorePosts = createSelector(getPostResults, get('hasMore'))

// Create a cached selector since we don't want multiple onscreen feedlists to clobber the cache between each other.
export const getQueryProps = createCachedSelector(
  (_, props) => props.group,
  (_, props) => props.sortBy,
  (_, props) => props.filter,
  (_, props) => props.topicName,
  (_, props) => props.order,
  (_, props) => props.afterTime,
  (_, props) => props.beforeTime,
  (group, sortBy, filter, topicName, order, afterTime, beforeTime) => {
    return omitBy(x => isNull(x) || isUndefined(x), {
      sortBy,
      filter,
      slug: get('slug', group),
      topic: topicName,
      order,
      afterTime,
      beforeTime
    })
  }
)(
  (_, props) => `${get('group.id', props)}:${get('topicName', props)}`
)
