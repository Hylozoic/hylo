import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

// TODO CONTEXT: SHAREABLE CODE

export const getContextWidgets = ormCreateSelector(
  orm,
  (state, group) => group,
  (session, group) => {
    return group?.contextWidgets?.items || []
  }
)
