import { get } from 'lodash/fp'
import { createSelector } from 'reselect'
import { FETCH_MODERATION_ACTIONS } from 'store/constants'
import orm from 'store/models'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { makeGetQueryResults } from 'store/reducers/queryResults'

export const getModerationActionResults = makeGetQueryResults(FETCH_MODERATION_ACTIONS)

export const getModerationActions = ormCreateSelector(
  orm,
  getModerationActionResults,
  (session, results) => {
    const ids = results?.ids || []
    if (ids.length === 0) return []

    return session.ModerationAction.all()
      .filter(x => ids.some(id => String(id) === String(x.id)))
      .orderBy(x => {
        const idx = ids.findIndex(id => String(id) === String(x.id))
        return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
      })
      .toModelArray()
  }
)

export const getHasMoreModerationActions = createSelector(getModerationActionResults, get('hasMore'))
export const getTotalModerationActions = createSelector(getModerationActionResults, get('total'))
