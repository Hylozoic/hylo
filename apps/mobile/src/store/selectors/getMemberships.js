import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

const getMemberships = ormCreateSelector(
  orm,
  session => {
    const me = session?.Me.first()
    if (!me) return []
    return me.memberships.toModelArray()
  }
)

export default getMemberships
