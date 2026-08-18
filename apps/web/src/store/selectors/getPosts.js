import { get } from 'lodash/fp'
import { createSelector } from 'reselect'
import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'
import { FETCH_POSTS } from 'store/constants'
import { makeGetQueryResults } from 'store/reducers/queryResults'
import { prependCurrentHourNotices } from 'store/util/chatActivityNotice'

export const getPostResults = makeGetQueryResults(FETCH_POSTS)

export const getPosts = ormCreateSelector(
  orm,
  getPostResults,
  (state, props) => props,
  (session, results, props) => {
    const ids = results?.ids || []
    const posts = ids.length === 0
      ? []
      : session.Post.all()
        .filter(x => ids.some(id => String(id) === String(x.id)))
        .orderBy(x => {
          const idx = ids.findIndex(id => String(id) === String(x.id))
          return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
        })
        .toModelArray()
    return prependCurrentHourNotices(session, posts, props || {})
  }
)

export const getHasMorePosts = createSelector(getPostResults, get('hasMore'))
export const getTotalPosts = createSelector(getPostResults, get('total'))
