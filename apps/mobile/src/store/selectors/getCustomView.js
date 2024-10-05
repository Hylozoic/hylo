import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

export const getCustomView = ormCreateSelector(
  orm,
  (_, props) => props?.customViewId,
  (session, customViewId) => customViewId && session.CustomView.safeGet({ id: customViewId })
)

export default getCustomView
