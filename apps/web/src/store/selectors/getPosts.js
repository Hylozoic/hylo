import { get } from 'lodash/fp'
import { createSelector } from 'reselect'
import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'
import { FETCH_POSTS } from 'store/constants'
import { makeGetQueryResults, modelsForIds } from 'store/reducers/queryResults'
import { prependCurrentHourNotices } from 'store/util/chatActivityNotice'

export const getPostResults = makeGetQueryResults(FETCH_POSTS)

export const getPosts = ormCreateSelector(
  orm,
  getPostResults,
  (state, props) => props,
  (session, results, props) => {
    const posts = modelsForIds(session.Post, results?.ids)
    return prependCurrentHourNotices(session, posts, props || {})
  }
)

export const getHasMorePosts = createSelector(getPostResults, get('hasMore'))
export const getTotalPosts = createSelector(getPostResults, get('total'))
