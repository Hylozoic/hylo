import { makeGetQueryResults } from 'store/reducers/queryResults'
import { FETCH_THREADS } from 'store/actions/fetchThreads'
import { createSelector } from 'reselect'
import { get } from 'lodash/fp'
import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

export const MODULE_NAME = 'ThreadList'
export const UPDATE_LAST_VIEWED = `${MODULE_NAME}/UPDATE_LAST_VIEWED`
export const UPDATE_LAST_VIEWED_PENDING = `${UPDATE_LAST_VIEWED}_PENDING`

export function updateLastViewed () {
  return {
    type: UPDATE_LAST_VIEWED,
    graphql: {
      query: `mutation ($changes: MeInput) {
        updateMe(changes: $changes) {
          id,
          name
        }
      }`,
      variables: {
        changes: {
          settings: {
            lastViewedMessagesAt: new Date()
          }
        }
      }
    },
    meta: {
      optimistic: true
    }
  }
}

const getThreadResults = makeGetQueryResults(FETCH_THREADS)

export const getThreads = ormCreateSelector(
  orm,
  session =>
    session?.MessageThread
      .all()
      .orderBy(thread => -new Date(thread.updatedAt))
      .toModelArray().map(thread => ({
        ...thread.ref,
        unread: thread.isUnread(),
        participants: thread.participants.toRefArray(),
        latestMessage: thread.messages.orderBy(m => -new Date(m.createdAt)).first()
      })
      )
)

export const getThreadsHasMore = createSelector(getThreadResults, get('hasMore'))
