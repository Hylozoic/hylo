import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

const getPeople = ormCreateSelector(
  orm,
  (state, { personIds }) => personIds,
  ({ Person }, personIds) => personIds && Person.filter(p => personIds.includes(p.id)).toModelArray()
)

export default getPeople
