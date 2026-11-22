import orm from '../models'
import { createSelector as ormCreateSelector } from 'redux-orm'

const getMe = ormCreateSelector(
  orm,
  session => {
    const me = session.Me.first()
    if (!me) return me
    // Touch profile links so edits to those rows re-render Edit Profile.
    me.profileLinks.toRefArray()
    return me
  }
)

export default getMe
