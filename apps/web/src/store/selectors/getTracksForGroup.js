import orm from '../models'
import { createSelector as ormCreateSelector } from 'redux-orm'

const getTracksForGroup = ormCreateSelector(
  orm,
  (state, props) => props.groupId,
  (session, groupId) => {
    const group = session.Group.withId(groupId)
    return group.tracks.toModelArray().sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
  }
)

export default getTracksForGroup
